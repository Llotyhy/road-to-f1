import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";
import StandingsTable from "./standings-table";
import type { StandingRow } from "./standings-table";

// Per-request render (the ?year= season pills read searchParams, which
// opts the route out of the full route cache) — instead, every query below
// is cached at the data layer, so each render is a few milliseconds.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
};

type Championship = {
  id: string;
  name: string;
  short_name: string;
  kind: string;
  tier: number | null;
  color: string | null;
};

type Season = {
  id: string;
  year: number;
  starts_on: string | null;
  ends_on: string | null;
};

type StandingsViewRow = {
  driver_id: string;
  points: number | string;
  wins: number;
  podiums: number;
  fastest_laps: number;
};

type EntryRow = {
  driver_id: string;
  rookie: boolean;
  final_position: number | null;
  final_points: number | string | null;
  driver: {
    id: string;
    full_name: string;
    slug: string;
    nationality: string | null;
    date_of_birth: string | null;
  } | null;
  team: { id: string; name: string } | null;
};

type AllocationRow = {
  position: number;
  points: number | string;
  valid_from_year: number;
  valid_to_year: number | null;
};

type WeekendRow = {
  round: number;
  name: string;
  circuit: string | null;
  country: string | null;
  date_from: string | null;
  date_to: string | null;
  sessions: Array<{ id: string; name: string; scheduled_on: string | null }>;
};

type ResultRow = {
  session_id: string;
  driver_id: string;
  finish_position: number | null;
  status: string;
  points: number | string | null;
  fastest_lap: boolean | null;
  team: { id: string; name: string } | null;
};

type SLRow = {
  driver_id: string;
  sl_points: number | string;
};

type WinnerRow = { session_id: string; driver: { full_name: string; slug: string } | null };

/** Country flag emoji computed from an ISO alpha-2 code via
 *  regional-indicator pairs — works for every country, no hard-coded list. */
function flagEmoji(code: string | null): string {
  if (!code) return "";
  const cc = code.toUpperCase().replace(/[^A-Z]/g, "");
  if (cc.length !== 2) return "";
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65
  );
}

/** Age at a given date (the season's start), in whole years — the same
 *  convention as the season-by-season table on the driver profiles. */
function ageAt(dob: string, on: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const t = new Date(on + "T00:00:00Z");
  let age = t.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    t.getUTCMonth() < d.getUTCMonth() ||
    (t.getUTCMonth() === d.getUTCMonth() && t.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Readable names for the championships, used for the og link previews
 *  (the class-page h1 shows the DB name; the URL id alone reads poorly).
 *  The browser tab itself is always "Road to F1" via the root layout.
 *  All 25 championships are mapped — the id-split fallback never fires. */
const CHAMPIONSHIP_TITLES: Record<string, string> = {
  f2: "F2",
  f3: "F3",
  freca: "FREC",
  frme: "FRME",
  "fr-americas": "FR Americas",
  "fr-oceania": "FR Oceania",
  "italian-f4": "Italian F4",
  "f4-british": "British F4",
  "f4-spanish": "Spanish F4",
  "f4-french": "French F4",
  "f4-uae": "F4 UAE",
  "f4-us": "US F4",
  "super-formula": "Super Formula",
  "macau-gp": "Macau GP",
  "formula-renault-eurocup": "Formula Renault Eurocup",
  "toyota-racing-series": "Toyota Racing Series",
  "german-f4": "German F4",
  indycar: "IndyCar",
  "indy-nxt": "Indy NXT",
  imsa: "IMSA",
  "nascar-cup": "NASCAR Cup",
  "formula-e": "Formula E",
  "gt-world-challenge-europe": "GT World Challenge Europe",
  "wec-hypercar": "WEC Hypercar",
  "wec-lmgt3": "WEC LMGT3",
};

function championshipTitle(id: string): string {
  const known = CHAMPIONSHIP_TITLES[id];
  if (known) return known;
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fmtDay(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function fmtRange(from: string | null, to: string | null): string {
  if (!from) return "TBC";
  if (!to) return fmtDay(from);
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  const month = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const sameMonth =
    f.getUTCFullYear() === t.getUTCFullYear() && f.getUTCMonth() === t.getUTCMonth();
  if (sameMonth) return `${f.getUTCDate()}–${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
  return `${f.getUTCDate()} ${month(f)} – ${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
}

/** Compact race list, e.g. [1, 2, 11, 12] -> "1-2, 11-12". */
function formatRaceList(races: number[]): string {
  const sorted = [...races].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  return parts.join(", ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const title = `${championshipTitle(id)} - Road to F1`;
  const description = `${championshipTitle(id)} standings, calendar and race results on Road to F1 — the junior single-seater database.`;
  // No metadata.title: the browser tab stays "Road to F1" on every page
  // (the root layout title); the per-championship name is link-preview only.
  return {
    description,
    openGraph: { title, description, url: `/championships/${id}`, images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
  };
}

export default async function ChampionshipPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { year } = await searchParams;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Road to F1</h1>
        <p>
          Supabase is not configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, fill in your project URL and keys, and restart.
        </p>
      </main>
    );
  }

  // Everything the page needs, in one data-layer cache entry. The route
  // renders per request (the ?year= season pills), so the full route cache
  // cannot hold it — instead the queries are wrapped in unstable_cache,
  // keyed on (championship, year), living for one hour or until
  // /api/revalidate purges the racing-data tag right after an ingestion.
  // Inside the cache the queries run as three parallel batches instead of
  // nine sequential round-trips.
  const loadData = unstable_cache(
    async () => {
      const sb = getSupabaseAdminClient();
      if (!sb) {
        return {
          championship: null as Championship | null,
          seasons: [] as Season[],
          season: null as Season | null,
          standings: [] as StandingsViewRow[],
          entries: [] as EntryRow[],
          weekends: [] as WeekendRow[],
          results: [] as ResultRow[],
          slRows: [] as SLRow[],
          winnersList: [] as Array<{ session_id: string; name: string; slug: string | null }>,
          allocations: [] as AllocationRow[],
        };
      }

      // Batch 1: the championship row, its seasons and its SL allocation
      // table — all keyed on the route id alone.
      const [championshipRes, seasonsRes, allocationRes] = await Promise.all([
        sb
          .from("championships")
          .select("id, name, short_name, kind, tier, color")
          .eq("id", id)
          .maybeSingle(),
        sb
          .from("seasons")
          .select("id, year, starts_on, ends_on")
          .eq("championship_id", id)
          .order("year", { ascending: false }),
        sb
          .from("sl_points_allocation")
          .select("position, points, valid_from_year, valid_to_year")
          .eq("championship_id", id),
      ]);
      const championship = championshipRes.data as unknown as Championship | null;
      const seasons = (seasonsRes.data ?? []) as unknown as Season[];

      // Selected season: ?year= param if it matches, else the latest season.
      const wantedYear = year ? Number(year) : null;
      const season =
        (wantedYear !== null && !Number.isNaN(wantedYear)
          ? seasons.find((s) => s.year === wantedYear)
          : undefined) ?? seasons[0] ?? null;

      let standings: StandingsViewRow[] = [];
      let entries: EntryRow[] = [];
      let weekends: WeekendRow[] = [];
      let results: ResultRow[] = [];
      let slRows: SLRow[] = [];
      const winnersList: Array<{ session_id: string; name: string; slug: string | null }> = [];

      if (championship && season) {
        // Batch 2: standings, entries, the calendar and the season's Super
        // Licence points — all keyed on the selected season.
        const [standingsRes, entriesRes, weekendsRes, slRes] = await Promise.all([
          sb
            .from("v_championship_standings")
            .select("driver_id, points, wins, podiums, fastest_laps")
            .eq("season_id", season.id),
          sb
            .from("season_entries")
            .select(
              "driver_id, rookie, final_position, final_points, driver:drivers(id, full_name, slug, nationality, date_of_birth), team:teams(id, name)"
            )
            .eq("season_id", season.id),
          sb
            .from("race_weekends")
            .select(
              "round, name, circuit, country, date_from, date_to, sessions(id, name, scheduled_on)"
            )
            .eq("season_id", season.id)
            .order("round"),
          sb
            .from("v_superlicence_season")
            .select("driver_id, sl_points")
            .eq("championship_id", id)
            .eq("year", season.year),
        ]);
        standings = (standingsRes.data ?? []) as unknown as StandingsViewRow[];
        entries = (entriesRes.data ?? []) as unknown as EntryRow[];
        weekends = (weekendsRes.data ?? []) as unknown as WeekendRow[];
        slRows = (slRes.data ?? []) as unknown as SLRow[];

        // Batch 3: the season's race winners and full per-race results.
        const sessionIds = weekends.flatMap((w) => w.sessions.map((s) => s.id));
        if (sessionIds.length > 0) {
          const [winnersRes, resultsRes] = await Promise.all([
            sb
              .from("results")
              .select("session_id, driver:drivers(full_name, slug)")
              .eq("finish_position", 1)
              .in("session_id", sessionIds),
            sb
              .from("results")
              .select(
                "session_id, driver_id, finish_position, status, points, fastest_lap, team:teams(id, name)"
              )
              .in("session_id", sessionIds),
          ]);
          for (const w of (winnersRes.data ?? []) as unknown as WinnerRow[]) {
            if (w.driver?.full_name) {
              winnersList.push({
                session_id: w.session_id,
                name: w.driver.full_name,
                slug: w.driver.slug ?? null,
              });
            }
          }
          results = (resultsRes.data ?? []) as unknown as ResultRow[];
        }
      }

      return {
        championship,
        seasons,
        season,
        standings,
        entries,
        weekends,
        results,
        slRows,
        winnersList,
        allocations: (allocationRes.data ?? []) as unknown as AllocationRow[],
      };
    },
    ["championship-page", id, year ?? "latest"],
    { revalidate: 3600, tags: ["racing-data"] }
  );

  const loaded = await loadData();

  const championship = loaded.championship;
  if (!championship) notFound();

  const seasons = loaded.seasons;
  const season = loaded.season;
  const standings = loaded.standings;
  const entries = loaded.entries;
  const weekends = loaded.weekends;
  const results = loaded.results;
  const allocations = loaded.allocations;
  const slByDriver = new Map<string, number>();
  for (const s of loaded.slRows) {
    slByDriver.set(s.driver_id, Number(s.sl_points ?? 0));
  }
  const winners = new Map<string, { name: string; slug: string | null }>();
  for (const w of loaded.winnersList) {
    winners.set(w.session_id, { name: w.name, slug: w.slug });
  }

  // Race number for every session of the season (calendar order: round, then
  // date, then name) — the same numbering the driver profiles use, so race
  // lists always match across the two pages.
  const raceNo = new Map<string, number>();
  {
    const sessions = weekends
      .flatMap((w) => w.sessions.map((s) => ({ ...s, round: w.round })))
      .sort(
        (a, b) =>
          a.round - b.round ||
          (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? "") ||
          a.name.localeCompare(b.name)
      );
    sessions.forEach((s, i) => raceNo.set(s.id, i + 1));
  }

  // A race session with zero CLASSIFIED result rows never ran — it was
  // cancelled (weather, crash, ...). Checking finish_position (not raw
  // row count) also covers sessions that carry only non-start rows —
  // e.g. the abandoned 2025 F3 Spa feature race, which stored a single
  // dns row for the pole-sitter's pole points. Races with classified
  // results but no winner keep the "no result yet" fallback below.
  const sessionsWithResults = new Set(
    results
      .filter((r) => r.finish_position !== null)
      .map((r) => r.session_id)
  );

  // Group the season's results per driver and per team stint, skipping
  // non-starts (a driver who DNS'd a race did not compete in it).
  type Stint = {
    teamName: string;
    races: number[];
    points: number;
    wins: number;
    podiums: number;
    fastestLaps: number;
  };
  const stintsByDriver = new Map<string, Map<string, Stint>>();
  for (const r of results) {
    if (r.status === "dns") continue;
    const no = raceNo.get(r.session_id);
    if (no === undefined) continue;
    let perDriver = stintsByDriver.get(r.driver_id);
    if (!perDriver) {
      perDriver = new Map();
      stintsByDriver.set(r.driver_id, perDriver);
    }
    const teamId = r.team?.id ?? "";
    let st = perDriver.get(teamId);
    if (!st) {
      st = {
        teamName: r.team?.name ?? "—",
        races: [],
        points: 0,
        wins: 0,
        podiums: 0,
        fastestLaps: 0,
      };
      perDriver.set(teamId, st);
    }
    st.races.push(no);
    st.points += Number(r.points ?? 0);
    if (r.finish_position === 1) st.wins += 1;
    if (r.finish_position !== null && r.finish_position >= 1 && r.finish_position <= 3) {
      st.podiums += 1;
    }
    if (r.fastest_lap) st.fastestLaps += 1;
  }

  // Championship standings: eligible (entered) drivers only, live from results.
  // Multi-team drivers get an expandable "N teams" link (career-table style);
  // their main row always shows the season totals.
  // Age is measured at the start of the season — the scheduled season start,
  // or the first weekend of the calendar when it is unknown.
  // SORT: the officials' final positions lead (they encode the tiebreaks,
  // e.g. a 37-37 title tie, and the décompte drops, so they are always the
  // authoritative order for a decided season); everything without one
  // (in-progress seasons, unranked guests) follows, ordered by the live
  // points, wins, podiums computation.
  const seasonStart =
    season?.starts_on ??
    (weekends
      .map((w) => w.date_from)
      .filter((d): d is string => d !== null)
      .sort()[0] ?? null);
  const entryByDriver = new Map(entries.map((e) => [e.driver_id, e]));
  const tableRows = standings
    .map((s) => {
      const entry = entryByDriver.get(s.driver_id);
      const stints = Array.from(stintsByDriver.get(s.driver_id)?.values() ?? []).sort(
        (a, b) => (a.races[0] ?? 0) - (b.races[0] ?? 0)
      );
      for (const st of stints) st.races.sort((a, b) => a - b);
      const totalRaces = stints.reduce((a, st) => a + st.races.length, 0);
      const multi = stints.length > 1;
      return {
        key: s.driver_id,
        points: Number(s.points ?? 0),
        wins: s.wins,
        podiums: s.podiums,
        fastestLaps: s.fastest_laps,
        finalPosition: entry?.final_position ?? null,
        name: entry?.driver?.full_name ?? entry?.driver?.slug ?? s.driver_id,
        slug: entry?.driver?.slug ?? null,
        nat: entry?.driver?.nationality ? flagEmoji(entry.driver.nationality) : "",
        age:
          seasonStart && entry?.driver?.date_of_birth
            ? ageAt(entry.driver.date_of_birth, seasonStart)
            : null,
        rookie: entry?.rookie ?? false,
        races: totalRaces,
        slPoints: slByDriver.get(s.driver_id) ?? null,
        teamName: multi
          ? ""
          : stints.length === 1
            ? stints[0].teamName
            : (entry?.team?.name ?? ""),
        multiTeams: multi
          ? stints.map((st) => ({
              teamName: st.teamName,
              raceList: formatRaceList(st.races),
              races: st.races.length,
              points: st.points,
              wins: st.wins,
              podiums: st.podiums,
              fastestLaps: st.fastestLaps,
            }))
          : null,
      };
    })
    .sort(
      (a, b) =>
        (a.finalPosition ?? 1e9) - (b.finalPosition ?? 1e9) ||
        b.points - a.points ||
        b.wins - a.wins ||
        b.podiums - a.podiums
    );

  const standingsRows: StandingRow[] = tableRows.map((r, i) => ({
    key: r.key,
    position: r.finalPosition ?? i + 1,
    name: r.name,
    slug: r.slug,
    nat: r.nat,
    age: r.age,
    rookie: r.rookie,
    teamName: r.teamName,
    races: r.races,
    points: r.points,
    wins: r.wins,
    podiums: r.podiums,
    fastestLaps: r.fastestLaps,
    slPoints: r.slPoints,
    multiTeams: r.multiTeams,
  }));

  // Super Licence projection for a season still in progress: the FIA awards
  // points only once a championship is complete (v_superlicence_season has
  // no rows until final positions are set), so until then the SL column shows,
  // in italics, what each driver would earn if the season ended today —
  // current standings order against the latest applicable allocation version
  // for the season's year, the same rule as the /rankings projections.
  const seasonDecided = entries.some((e) => e.final_position !== null);
  let slProvisional = false;
  if (season && !seasonDecided && standingsRows.length > 0) {
    const latestAlloc = new Map<number, { from: number; pts: number }>();
    for (const a of allocations) {
      if (season.year < a.valid_from_year) continue;
      if (a.valid_to_year !== null && season.year > a.valid_to_year) continue;
      const cur = latestAlloc.get(a.position);
      if (!cur || a.valid_from_year > cur.from) {
        latestAlloc.set(a.position, {
          from: a.valid_from_year,
          pts: Number(a.points ?? 0),
        });
      }
    }
    if (latestAlloc.size > 0) {
      let any = false;
      standingsRows.slice(0, 10).forEach((r) => {
        const alloc = latestAlloc.get(r.position ?? -1);
        if (alloc) {
          r.slPoints = alloc.pts;
          any = true;
        }
      });
      slProvisional = any;
    }
  }

  // Season status: a season is complete when its (scheduled) end date has
  // passed with no end date missing - drives the "Final standings" vs
  // "Current standings" header. Rounds done = weekends with at least one
  // classified result (live from the data, no flags needed).
  const today = new Date().toISOString().slice(0, 10); // UTC date
  const seasonComplete = !season || !season.ends_on || today > season.ends_on;
  const totalRounds = weekends.length;
  const roundsDone = new Set(
    weekends
      .filter((w) => w.sessions.some((s) => sessionsWithResults.has(s.id)))
      .map((w) => w.round)
  ).size;

  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #ddd",
    fontSize: 13,
    color: "#888",
  };
  const td = {
    padding: "8px 10px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top" as const,
  };
  const link = { color: "#1d4ed8", textDecoration: "none" } as const;
  const accent = championship.color ?? "#1d4ed8";

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>
        <span style={{ color: championship.color ?? undefined }}>
          {championship.short_name}
        </span>{" "}
        {season ? season.year : ""}
      </h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        {championship.name}
        {season ? ` · ${fmtRange(season.starts_on, season.ends_on)}` : ""}
      </p>

      {/* Season switcher */}
      {seasons.length > 0 && (
        <nav aria-label="Season" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0.75rem 0 1.5rem" }}>
          {seasons.map((s) => {
            const active = season?.id === s.id;
            return (
              <Link
                key={s.id}
                href={`/championships/${id}?year=${s.year}`}
                style={{
                  padding: "4px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  textDecoration: "none",
                  border: `1px solid ${active ? accent : "#ccc"}`,
                  color: active ? "#fff" : "#444",
                  background: active ? accent : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {s.year}
              </Link>
            );
          })}
        </nav>
      )}

      {!season && <p>No season ingested for this championship yet.</p>}

      {season && standingsRows.length > 0 && (
        <section aria-label="Championship standings">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>
            {seasonComplete ? "Final standings" : "Current standings"}
          </h2>
          {!seasonComplete && (
            <p style={{ margin: "0 0 12px", color: "#777", fontSize: 14 }}>
              After {roundsDone}/{totalRounds} rounds
            </p>
          )}
          {entries.some((e) => e.final_points !== null) && (
            <p style={{ margin: "0 0 12px", color: "#777", fontSize: 14 }}>
              Points are the officials&rsquo; final totals —{" "}
              {id === "super-formula" ? (
                <>
                  the championship counts each driver&rsquo;s five best
                  of the season&rsquo;s races (the 2020 rule).
                </>
              ) : (
                <>
                  the <em>décompte</em> drops each driver&rsquo;s worst
                  meeting of the season.
                </>
              )}
            </p>
          )}
          {slProvisional && (
            <p style={{ margin: "0 0 12px", color: "#777", fontSize: 14 }}>
              <em>SL points are provisional</em> — what each driver would earn
              if the season ended now. The FIA awards Super Licence points only
              once a championship is complete.
            </p>
          )}
          <StandingsTable rows={standingsRows} slProvisional={slProvisional} />
        </section>
      )}

      {season && standingsRows.length === 0 && (
        <p>
          No race results ingested for {season.year} yet — run a season data
          file in the Supabase SQL editor.
        </p>
      )}

      {weekends.length > 0 && (
        <section aria-label="Race calendar" style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Calendar</h2>
          {/* .r2f1-tablewrap: the calendar scrolls inside this box on
              phones instead of dragging the page sideways. */}
          <div className="r2f1-tablewrap">
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>Rd</th>
                <th style={th}>Date</th>
                <th style={th}>Circuit</th>
                <th style={th}>Races</th>
              </tr>
            </thead>
            <tbody>
              {weekends.map((w) => (
                <tr key={w.round}>
                  <td style={td}>{w.round}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtRange(w.date_from, w.date_to)}</td>
                  <td style={td}>
                    {w.country ? `${flagEmoji(w.country)} ` : ""}
                    {w.name}
                    {w.circuit ? (
                      <span style={{ color: "#777" }}> — {w.circuit}</span>
                    ) : null}
                  </td>
                  <td style={td}>
                    {[...w.sessions]
                      .sort((a, b) =>
                        (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? "") ||
                        a.name.localeCompare(b.name)
                      )
                      .map((s) => {
                        const winner = winners.get(s.id);
                        return (
                          <div key={s.id}>
                            {s.name} —{" "}
                            {winner ? (
                              <strong>
                                {winner.slug ? (
                                  <Link href={`/drivers/${winner.slug}`} style={link}>
                                    {winner.name}
                                  </Link>
                                ) : (
                                  winner.name
                                )}
                              </strong>
                            ) : !sessionsWithResults.has(s.id) ? (
                              <span
                                style={{ color: "#999", fontStyle: "italic" }}
                              >
                                {(s.scheduled_on ?? "") >= today
                                  ? "Upcoming"
                                  : "Race cancelled"}
                              </span>
                            ) : (
                              <span style={{ color: "#999" }}>no result yet</span>
                            )}{" "}
                            <span style={{ color: "#999", fontSize: 12 }}>
                              ({fmtDay(s.scheduled_on)})
                            </span>
                          </div>
                        );
                      })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </main>
  );
}
