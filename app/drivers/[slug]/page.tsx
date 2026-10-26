import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";
import CareerTable from "./career-table";
import type { CareerRow } from "./career-table";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

type Driver = {
  id: string;
  slug: string;
  full_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  place_of_birth: string | null;
  headshot_url: string | null;
  notes: string | null;
};

type CareerViewRow = {
  year: number;
  championship_id: string;
  short_name: string;
  team_id: string | null;
  rookie: boolean;
  final_position: number | null;
};

type SeasonRow = {
  id: string;
  championship_id: string;
  year: number;
  starts_on: string | null;
};

type WeekendRow = {
  round: number;
  season_id: string;
  sessions: Array<{ id: string; name: string; scheduled_on: string | null }>;
};

type ResultRow = {
  session_id: string;
  team_id: string | null;
  finish_position: number | null;
  status: string;
  points: number | string | null;
  fastest_lap: boolean | null;
};

type SeasonStandingRow = {
  driver_id: string;
  points: number | string;
  wins: number;
  podiums: number;
};

type SeasonEntryRow = {
  driver_id: string;
  final_position: number | null;
};

type SLRow = {
  championship_id: string;
  year: number;
  sl_points: number | string;
};

type Team = { id: string; name: string };

/** Compute the flag emoji from an ISO 3166-1 alpha-2 code. */
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65)
  );
}

/** Ordinal suffix for a day number: 1 -> "1st", 2 -> "2nd", 9 -> "9th", 21 -> "21st". */
function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

/** Date of birth as "August 9th 2008". */
function fmtDob(dob: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00Z");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getUTCMonth()]} ${ordinal(d.getUTCDate())} ${d.getUTCFullYear()}`;
}

function calcAge(dob: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Age at a given date (the season's first race), in whole years. */
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
  const { slug } = await params;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { title: "Road to F1" };
  const { data } = await supabase
    .from("drivers")
    .select("full_name")
    .eq("slug", slug)
    .maybeSingle();
  const name =
    (data as unknown as { full_name: string } | null)?.full_name ??
    slug.replace(/-/g, " ");
  return { title: `${name} - Road to F1` };
}

export default async function DriverPage({ params }: PageProps) {
  const { slug } = await params;
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

  const { data: driverData } = await supabase
    .from("drivers")
    .select("id, slug, full_name, date_of_birth, nationality, place_of_birth, headshot_url, notes")
    .eq("slug", slug)
    .maybeSingle();
  const driver = driverData as unknown as Driver | null;
  if (!driver) notFound();

  const { data: careerData } = await supabase
    .from("v_driver_career")
    .select("year, championship_id, short_name, team_id, rookie, final_position")
    .eq("driver_id", driver.id);
  const career = ((careerData ?? []) as unknown as CareerViewRow[]).slice().sort(
    (a, b) => a.year - b.year || a.championship_id.localeCompare(b.championship_id)
  );

  // Seasons for every championship this driver ever entered.
  const champIds = Array.from(new Set(career.map((c) => c.championship_id)));
  const seasonsByKey = new Map<string, SeasonRow>();
  if (champIds.length > 0) {
    const { data: seasonsData } = await supabase
      .from("seasons")
      .select("id, championship_id, year, starts_on")
      .in("championship_id", champIds);
    for (const s of (seasonsData ?? []) as unknown as SeasonRow[]) {
      seasonsByKey.set(`${s.championship_id}:${s.year}`, s);
    }
  }

  // Race calendar for those seasons: gives us race numbers (order of every
  // session in the season) and the date of each season's first race.
  type SeasonInfo = {
    raceNo: Map<string, number>;
    nSessions: number;
    firstRaceDate: string | null;
  };
  const seasonInfo = new Map<string, SeasonInfo>();
  const sessionSeason = new Map<string, string>(); // session id -> season key
  const seasonIds = Array.from(
    new Set(
      career
        .map((c) => seasonsByKey.get(`${c.championship_id}:${c.year}`)?.id)
        .filter((id): id is string => !!id)
    )
  );
  if (seasonIds.length > 0) {
    const { data: weekendsData } = await supabase
      .from("race_weekends")
      .select("round, season_id, sessions(id, name, scheduled_on)")
      .in("season_id", seasonIds);
    const weekends = (weekendsData ?? []) as unknown as WeekendRow[];
    for (const c of career) {
      const key = `${c.championship_id}:${c.year}`;
      if (seasonInfo.has(key)) continue;
      const seasonId = seasonsByKey.get(key)?.id;
      const ws = seasonId ? weekends.filter((w) => w.season_id === seasonId) : [];
      const sessions = ws
        .flatMap((w) => w.sessions.map((s) => ({ ...s, round: w.round })))
        .sort(
          (a, b) =>
            a.round - b.round ||
            (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? "") ||
            a.name.localeCompare(b.name)
        );
      const raceNo = new Map<string, number>();
      sessions.forEach((s, i) => {
        raceNo.set(s.id, i + 1);
        sessionSeason.set(s.id, key);
      });
      const dates = sessions
        .map((s) => s.scheduled_on)
        .filter((d): d is string => !!d)
        .sort();
      seasonInfo.set(key, {
        raceNo,
        nSessions: sessions.length,
        firstRaceDate: dates[0] ?? seasonsByKey.get(key)?.starts_on ?? null,
      });
    }
  }

  // The driver's raw per-race results (team at the time of each session).
  const { data: resultsData } = await supabase
    .from("results")
    .select("session_id, team_id, finish_position, status, points, fastest_lap")
    .eq("driver_id", driver.id);
  const results = (resultsData ?? []) as unknown as ResultRow[];

  // Group the results per season and per team stint.
  const resultsBySeason = new Map<string, ResultRow[]>();
  for (const r of results) {
    const key = sessionSeason.get(r.session_id);
    if (!key) continue;
    const list = resultsBySeason.get(key);
    if (list) list.push(r);
    else resultsBySeason.set(key, [r]);
  }

  // Championship position per season — computed exactly like the season page
  // (official final position when stored, otherwise the row's place in the
  // standings table), so the two pages can never disagree.
  const positionBySeason = new Map<string, number>();
  for (const key of resultsBySeason.keys()) {
    const season = seasonsByKey.get(key);
    if (!season) continue;
    const { data: stData } = await supabase
      .from("v_championship_standings")
      .select("driver_id, points, wins, podiums")
      .eq("season_id", season.id);
    const { data: entData } = await supabase
      .from("season_entries")
      .select("driver_id, final_position")
      .eq("season_id", season.id);
    const entryPos = new Map(
      ((entData ?? []) as unknown as SeasonEntryRow[]).map((e) => [e.driver_id, e.final_position])
    );
    const tableRows = ((stData ?? []) as unknown as SeasonStandingRow[])
      .map((s) => ({
        driver_id: s.driver_id,
        points: Number(s.points ?? 0),
        wins: s.wins,
        podiums: s.podiums,
        finalPosition: entryPos.get(s.driver_id) ?? null,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          b.podiums - a.podiums ||
          (a.finalPosition ?? 999) - (b.finalPosition ?? 999)
      );
    for (let i = 0; i < tableRows.length; i++) {
      if (tableRows[i].driver_id === driver.id) {
        positionBySeason.set(key, tableRows[i].finalPosition ?? i + 1);
        break;
      }
    }
  }

  // Super Licence points per season.
  const { data: slData } = await supabase
    .from("v_superlicence_season")
    .select("championship_id, year, sl_points")
    .eq("driver_id", driver.id);
  const slRows = (slData ?? []) as unknown as SLRow[];

  // Team names (entry teams + per-race teams).
  const teamIds = new Set<string>();
  for (const c of career) if (c.team_id) teamIds.add(c.team_id);
  for (const r of results) if (r.team_id) teamIds.add(r.team_id);
  const teams = new Map<string, string>();
  if (teamIds.size > 0) {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", Array.from(teamIds));
    for (const t of (teamsData ?? []) as unknown as Team[]) {
      teams.set(t.id, t.name);
    }
  }

  // Build the career rows: totals per season, split by team when the driver
  // switched teams mid-season. FT = the stint covered at least 60% of the
  // season's races (so missing a round or two through injury still counts
  // as full-time); PT = shorter stints and one-offs.
  const rows: CareerRow[] = career.map((c) => {
    const key = `${c.championship_id}:${c.year}`;
    const info = seasonInfo.get(key);
    const seasonResults = resultsBySeason.get(key) ?? [];

    type Stint = {
      teamName: string;
      races: number[];
      points: number;
      wins: number;
      podiums: number;
      fastestLaps: number;
    };
    const stintMap = new Map<string, Stint>();
    for (const r of seasonResults) {
      if (r.status === "dns") continue;
      const raceNo = info?.raceNo.get(r.session_id);
      if (raceNo === undefined) continue;
      const tId = r.team_id ?? "";
      let st = stintMap.get(tId);
      if (!st) {
        st = { teamName: teams.get(tId) ?? "—", races: [], points: 0, wins: 0, podiums: 0, fastestLaps: 0 };
        stintMap.set(tId, st);
      }
      st.races.push(raceNo);
      st.points += Number(r.points ?? 0);
      if (r.finish_position === 1) st.wins += 1;
      if (r.finish_position !== null && r.finish_position >= 1 && r.finish_position <= 3) {
        st.podiums += 1;
      }
      if (r.fastest_lap) st.fastestLaps += 1;
    }
    const stints = Array.from(stintMap.values()).sort(
      (a, b) => (a.races[0] ?? 0) - (b.races[0] ?? 0)
    );
    for (const st of stints) st.races.sort((a, b) => a - b);

    const isFullTime = (races: number): boolean =>
      !!info && info.nSessions > 0 && races >= 0.6 * info.nSessions;

    const totalRaces = stints.reduce((a, st) => a + st.races.length, 0);
    const totalPoints = stints.reduce((a, st) => a + st.points, 0);
    const totalWins = stints.reduce((a, st) => a + st.wins, 0);
    const totalPodiums = stints.reduce((a, st) => a + st.podiums, 0);
    const totalFl = stints.reduce((a, st) => a + st.fastestLaps, 0);

    const sl = slRows.find(
      (s) => s.year === c.year && s.championship_id === c.championship_id
    );

    const multi = stints.length > 1;
    const singleTeamName =
      stints.length === 1
        ? stints[0].teamName
        : (c.team_id ? teams.get(c.team_id) ?? "" : "");

    return {
      key,
      year: c.year,
      age:
        driver.date_of_birth && info?.firstRaceDate
          ? ageAt(driver.date_of_birth, info.firstRaceDate)
          : null,
      championshipId: c.championship_id,
      shortName: c.short_name,
      rookie: c.rookie,
      position: positionBySeason.get(key) ?? null,
      races: seasonResults.length > 0 ? totalRaces : null,
      points: seasonResults.length > 0 ? totalPoints : null,
      wins: seasonResults.length > 0 ? totalWins : null,
      podiums: seasonResults.length > 0 ? totalPodiums : null,
      fastestLaps: seasonResults.length > 0 ? totalFl : null,
      slPoints: sl ? Number(sl.sl_points ?? 0) : null,
      teamName: multi ? "" : singleTeamName,
      ft: stints.length === 1 ? isFullTime(totalRaces) : null,
      multiTeams: multi
        ? stints.map((st) => ({
            teamName: st.teamName,
            raceList: formatRaceList(st.races),
            races: st.races.length,
            points: st.points,
            wins: st.wins,
            podiums: st.podiums,
            fastestLaps: st.fastestLaps,
            ft: isFullTime(st.races.length),
          }))
        : null,
    };
  });

  // Career totals across all championships
  const totals = {
    yearsOnRoad: new Set(career.map((c) => c.year)).size,
    racesOnRecord: results.filter((r) => r.status !== "dns").length,
    wins: results.filter((r) => r.finish_position === 1).length,
    podiums: results.filter(
      (r) => r.finish_position !== null && r.finish_position >= 1 && r.finish_position <= 3
    ).length,
  };

  const statBox = {
    flex: "1 1 0",
    minWidth: 120,
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: "10px 14px",
  } as const;

  return (
    <main style={{ maxWidth: 1040, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: 14 }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          ← Road to F1
        </Link>
      </p>

      <header style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {driver.headshot_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driver.headshot_url}
                alt=""
                width={72}
                height={72}
                style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e5e5" }}
              />
            )}
            <h1 style={{ marginBottom: 2, textAlign: "left" }}>{driver.full_name}</h1>
          </div>
          {driver.nationality && (
            <div style={{ fontSize: 40, lineHeight: 1.1, flexShrink: 0 }}>
              {flagEmoji(driver.nationality)}
            </div>
          )}
        </div>
        <p style={{ margin: "4px 0 2px", color: "#555", fontSize: 15 }}>
          Date of birth:{" "}
          {driver.date_of_birth
            ? `${fmtDob(driver.date_of_birth)} (${calcAge(driver.date_of_birth)} years old)`
            : "—"}
        </p>
        <p style={{ margin: "2px 0", color: "#555", fontSize: 15 }}>
          Place of birth: {driver.place_of_birth ?? "—"}
        </p>
      </header>

      {driver.notes && <p style={{ color: "#555", marginTop: 12 }}>{driver.notes}</p>}

      {career.length > 0 && (
        <section aria-label="Career totals" style={{ display: "flex", gap: 10, marginTop: "1.25rem", flexWrap: "wrap" }}>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Years on the road</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.yearsOnRoad}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Races on record</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.racesOnRecord}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Wins</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.wins}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Podiums</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.podiums}</div>
          </div>
        </section>
      )}

      <section aria-label="Career ladder" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Career</h2>
        {rows.length === 0 ? (
          <p>No seasons recorded for this driver yet.</p>
        ) : (
          <CareerTable rows={rows} />
        )}
      </section>
    </main>
  );
}
