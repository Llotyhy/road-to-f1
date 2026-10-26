import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";
import StandingsTable from "./standings-table";
import type { StandingRow } from "./standings-table";

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
  driver: { id: string; full_name: string; slug: string } | null;
  team: { id: string; name: string } | null;
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

const FLAGS: Record<string, string> = {
  AT: "🇦🇹", AU: "🇦🇺", BE: "🇧🇪", BR: "🇧🇷", CA: "🇨🇦", CH: "🇨🇭",
  DE: "🇩🇪", DK: "🇩🇰", ES: "🇪🇸", FR: "🇫🇷", GB: "🇬🇧", HU: "🇭🇺",
  IT: "🇮🇹", JP: "🇯🇵", MC: "🇲🇨", NL: "🇳🇱", PT: "🇵🇹", US: "🇺🇸",
  ZA: "🇿🇦",
};

/** Browser-tab names for the championships (the URL id alone reads poorly). */
const CHAMPIONSHIP_TITLES: Record<string, string> = {
  f2: "F2",
  f3: "F3",
  freca: "FREC",
  "italian-f4": "Italian F4",
  indycar: "IndyCar",
  "formula-e": "Formula E",
  "super-formula": "Super Formula",
  "wec-hypercar": "WEC Hypercar",
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
  return { title: `${championshipTitle(id)} - Road to F1` };
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

  const { data: championshipData } = await supabase
    .from("championships")
    .select("id, name, short_name, kind, tier, color")
    .eq("id", id)
    .maybeSingle();
  const championship = championshipData as unknown as Championship | null;
  if (!championship) notFound();

  // All ingested seasons for this championship, newest first.
  const { data: seasonsData } = await supabase
    .from("seasons")
    .select("id, year, starts_on, ends_on")
    .eq("championship_id", id)
    .order("year", { ascending: false });
  const seasons = (seasonsData ?? []) as unknown as Season[];

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
  const slByDriver = new Map<string, number>();
  const winners = new Map<string, { name: string; slug: string | null }>();

  if (season) {
    const { data: standingsData } = await supabase
      .from("v_championship_standings")
      .select("driver_id, points, wins, podiums, fastest_laps")
      .eq("season_id", season.id);
    standings = (standingsData ?? []) as unknown as StandingsViewRow[];

    const { data: entriesData } = await supabase
      .from("season_entries")
      .select(
        "driver_id, rookie, final_position, driver:drivers(id, full_name, slug), team:teams(id, name)"
      )
      .eq("season_id", season.id);
    entries = (entriesData ?? []) as unknown as EntryRow[];

    const { data: weekendsData } = await supabase
      .from("race_weekends")
      .select("round, name, circuit, country, date_from, date_to, sessions(id, name, scheduled_on)")
      .eq("season_id", season.id)
      .order("round");
    weekends = (weekendsData ?? []) as unknown as WeekendRow[];

    const sessionIds = weekends.flatMap((w) => w.sessions.map((s) => s.id));
    if (sessionIds.length > 0) {
      const { data: winnersData } = await supabase
        .from("results")
        .select("session_id, driver:drivers(full_name, slug)")
        .eq("finish_position", 1)
        .in("session_id", sessionIds);
      for (const w of (winnersData ?? []) as unknown as WinnerRow[]) {
        if (w.driver?.full_name) {
          winners.set(w.session_id, { name: w.driver.full_name, slug: w.driver.slug ?? null });
        }
      }

      // Per-race results for the season: race counts and per-team stints.
      const { data: resultsData } = await supabase
        .from("results")
        .select(
          "session_id, driver_id, finish_position, status, points, fastest_lap, team:teams(id, name)"
        )
        .in("session_id", sessionIds);
      results = (resultsData ?? []) as unknown as ResultRow[];
    }

    // Super Licence points for this championship season.
    const { data: slData } = await supabase
      .from("v_superlicence_season")
      .select("driver_id, sl_points")
      .eq("championship_id", id)
      .eq("year", season.year);
    for (const s of (slData ?? []) as unknown as SLRow[]) {
      slByDriver.set(s.driver_id, Number(s.sl_points ?? 0));
    }
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
        b.points - a.points ||
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        (a.finalPosition ?? 999) - (b.finalPosition ?? 999)
    );

  const standingsRows: StandingRow[] = tableRows.map((r, i) => ({
    key: r.key,
    position: r.finalPosition ?? i + 1,
    name: r.name,
    slug: r.slug,
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
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: 14 }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          ← Road to F1
        </Link>
      </p>

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
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Standings</h2>
          <StandingsTable rows={standingsRows} />
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
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
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
                    {w.country ? `${FLAGS[w.country] ?? ""} ` : ""}
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
        </section>
      )}
    </main>
  );
}
