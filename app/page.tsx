import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** The wordmark chevrons — the five rungs of the ladder, F4 to F1, in
 *  class colours. Same geometry as the site header and the OG lockup. */
function HeroChevrons({ size = 44 }: { size?: number }) {
  const chevrons = ["#fafafa", "#1e3a8a", "#f97316", "#2563eb", "#e10600"];
  return (
    <svg
      width={(size * 41) / 14}
      height={size}
      viewBox="0 0 41 14"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {chevrons.map((c, i) => (
        <path
          key={c}
          d={`M${2 + i * 8} 1.5 L${7 + i * 8} 7 L${2 + i * 8} 12.5`}
          fill="none"
          stroke={c}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Country flag emoji from an ISO alpha-2 code (regional-indicator pairs). */
function flagEmoji(code: string | null): string {
  if (!code) return "";
  const cc = code.toUpperCase().replace(/[^A-Z]/g, "");
  if (cc.length !== 2) return "";
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65
  );
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

/** "Dec 5–6" / "Nov 30 – Dec 1" from weekend dates. */
function fmtDayRange(from: string | null, to: string | null): string {
  if (!from) return "";
  const f = new Date(from + "T00:00:00Z");
  const t = to ? new Date(to + "T00:00:00Z") : null;
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  if (!t) return `${mon(f)} ${day(f)}`;
  if (f.getUTCMonth() === t.getUTCMonth()) return `${mon(f)} ${day(f)}–${day(t)}`;
  return `${mon(f)} ${day(f)} – ${mon(t)} ${day(t)}`;
}

/** Ladder championships that feed the homepage. */
const LADDER_IDS = ["f2", "f3", "freca", "italian-f4", "f4-british", "f4-spanish", "f4-french"];

/** Strip labels + class colours per series (design-level, not data). */
const SERIES_META: Record<string, { short: string; color: string }> = {
  f2: { short: "F2", color: "#2563eb" },
  f3: { short: "F3", color: "#f97316" },
  freca: { short: "FREC", color: "#1e3a8a" },
  "italian-f4": { short: "ITA F4", color: "#fafafa" },
  "f4-british": { short: "BF4", color: "#fafafa" },
  "f4-spanish": { short: "ES F4", color: "#fafafa" },
  "f4-french": { short: "FR F4", color: "#fafafa" },
};

/** The F4 box's national chips, in display order. */
const F4_CHIPS = [
  { id: "italian-f4", label: "Italian" },
  { id: "f4-british", label: "British" },
  { id: "f4-spanish", label: "Spanish" },
  { id: "f4-french", label: "French" },
];

type SeasonRow = { id: string; championship_id: string; year: number; ends_on: string | null };
type StandingsRow = { season_id: string; driver_id: string; points: number | string; wins: number; podiums: number };
type EntryRow = {
  season_id: string;
  driver_id: string;
  rookie: boolean;
  final_position: number | null;
  final_points: number | string | null;
  driver: { full_name: string; slug: string; nationality: string | null } | null;
  team: { name: string } | null;
};
type WeekendRow = { round: number; name: string; date_from: string | null; date_to: string | null; sessions: { id: string }[] };

type Champion = {
  championshipId: string;
  year: number;
  name: string;
  slug: string | null;
  flag: string;
  team: string;
  points: number;
  wins: number;
  rookie: boolean;
};

type RaceRow = { name: string; slug: string | null; flag: string; points: number };
type TitleRace = {
  year: number;
  roundsDone: number | null;
  totalRounds: number | null;
  finale: { name: string; date: string } | null;
  leader: RaceRow;
  chaser: RaceRow | null;
};

export default async function Home() {
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

  // 1 · All seasons of the ladder championships (75 rows — well under the
  //     1000-row response cap; the per-season queries below stay small too).
  const { data: seasonsData, error: seasonsErr } = await supabase
    .from("seasons")
    .select("id, championship_id, year, ends_on")
    .in("championship_id", LADDER_IDS);

  if (seasonsErr) {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Road to F1</h1>
        <p>Database error: {seasonsErr.message}</p>
        <p>Did you run supabase/schema.sql in the SQL editor?</p>
      </main>
    );
  }

  const seasons = (seasonsData ?? []) as unknown as SeasonRow[];

  // Years per championship (hero box meta) + latest season per championship.
  const yearsByChamp = new Map<string, number[]>();
  const latestByChamp = new Map<string, SeasonRow>();
  for (const s of seasons) {
    const list = yearsByChamp.get(s.championship_id) ?? [];
    list.push(s.year);
    yearsByChamp.set(s.championship_id, list);
    const cur = latestByChamp.get(s.championship_id);
    if (!cur || s.year > cur.year) latestByChamp.set(s.championship_id, s);
  }

  const seasonIds = Array.from(latestByChamp.values()).map((s) => s.id);

  // 2 · Standings + entries for the latest season of each championship
  //     (7 seasons × ~50 drivers — comfortably under the 1000-row cap),
  //     plus the driver count for the search placeholder.
  const [driversRes, standingsRes, entriesRes] = await Promise.all([
    supabase.from("drivers").select("id", { count: "exact", head: true }),
    seasonIds.length
      ? supabase
          .from("v_championship_standings")
          .select("season_id, driver_id, points, wins, podiums")
          .in("season_id", seasonIds)
      : Promise.resolve({ data: [] as unknown[] }),
    seasonIds.length
      ? supabase
          .from("season_entries")
          .select(
            "season_id, driver_id, rookie, final_position, final_points, driver:drivers(full_name, slug, nationality), team:teams(name)"
          )
          .in("season_id", seasonIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const standings = (standingsRes.data ?? []) as unknown as StandingsRow[];
  const entries = (entriesRes.data ?? []) as unknown as EntryRow[];

  const standingsBySeason = new Map<string, StandingsRow[]>();
  for (const r of standings) {
    const list = standingsBySeason.get(r.season_id) ?? [];
    list.push(r);
    standingsBySeason.set(r.season_id, list);
  }
  const entryBySeasonDriver = new Map<string, EntryRow>();
  for (const e of entries) entryBySeasonDriver.set(`${e.season_id}:${e.driver_id}`, e);

  const today = new Date().toISOString().slice(0, 10); // UTC date

  /** The season page's exact sort: points, wins, podiums, official position. */
  function sortedRows(seasonId: string): StandingsRow[] {
    const rows = standingsBySeason.get(seasonId) ?? [];
    const pos = (driverId: string) =>
      entryBySeasonDriver.get(`${seasonId}:${driverId}`)?.final_position ?? 999;
    return [...rows].sort(
      (a, b) =>
        Number(b.points ?? 0) - Number(a.points ?? 0) ||
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        pos(a.driver_id) - pos(b.driver_id)
    );
  }

  /** Champion of a completed season: the official final_position 1 if the
   *  ingestion recorded it, else the top of the live-computed standings. */
  function championOf(season: SeasonRow): Champion | null {
    const official = entries.find(
      (e) => e.season_id === season.id && e.final_position === 1
    );
    const rows = sortedRows(season.id);
    let driverId: string | null = official?.driver_id ?? null;
    let row: StandingsRow | null = null;
    if (!driverId && rows.length > 0) {
      driverId = rows[0].driver_id;
      row = rows[0];
    } else if (driverId) {
      row = rows.find((r) => r.driver_id === driverId) ?? null;
    }
    if (!driverId) return null;
    const entry = entryBySeasonDriver.get(`${season.id}:${driverId}`);
    const name = entry?.driver?.full_name;
    if (!name) return null;
    return {
      championshipId: season.championship_id,
      year: season.year,
      name,
      slug: entry?.driver?.slug ?? null,
      flag: flagEmoji(entry?.driver?.nationality ?? null),
      team: entry?.team?.name ?? "",
      points: row ? Number(row.points ?? 0) : Number(entry?.final_points ?? 0),
      wins: row?.wins ?? 0,
      rookie: entry?.rookie ?? false,
    };
  }

  // Champions: latest season of each championship, included only once it
  // has ended — the strip fills itself in as seasons complete.
  const crowned: Champion[] = [];
  for (const id of ["f3", "freca", "italian-f4", "f4-british", "f4-french", "f4-spanish", "f2"]) {
    const season = latestByChamp.get(id);
    if (!season) continue;
    const complete = !season.ends_on || today > season.ends_on;
    if (!complete) continue;
    const champ = championOf(season);
    if (champ) crowned.push(champ);
  }

  // The F2 title race: while the latest F2 season is in progress, show the
  // live top two. Once it ends, F2 joins the champion cards and this
  // card disappears on its own.
  let titleRace: TitleRace | null = null;
  const f2Season = latestByChamp.get("f2");
  if (f2Season && f2Season.ends_on && today <= f2Season.ends_on) {
    const rows = sortedRows(f2Season.id);
    if (rows.length > 0) {
      const { data: weekendsData } = await supabase
        .from("race_weekends")
        .select("round, name, date_from, date_to, sessions(id)")
        .eq("season_id", f2Season.id)
        .order("round");
      const weekends = (weekendsData ?? []) as unknown as WeekendRow[];

      const sessionRound = new Map<string, number>();
      for (const w of weekends) {
        for (const s of w.sessions) sessionRound.set(s.id, w.round);
      }

      // Rounds done = weekends with at least one result on record (via the
      // leader's sessions — a full-season driver touches every scored
      // weekend; same definition as the championship page's X/Y rounds).
      const sessionIds = Array.from(sessionRound.keys());
      let roundsDone: number | null = null;
      if (sessionIds.length > 0) {
        const { data: leaderResults } = await supabase
          .from("results")
          .select("session_id")
          .eq("driver_id", rows[0].driver_id)
          .in("session_id", sessionIds);
        roundsDone = new Set(
          ((leaderResults ?? []) as { session_id: string }[])
            .map((r) => sessionRound.get(r.session_id))
            .filter((n): n is number => n != null)
        ).size;
      }

      const last = weekends[weekends.length - 1] ?? null;
      const raceRow = (r: StandingsRow): RaceRow => {
        const e = entryBySeasonDriver.get(`${f2Season.id}:${r.driver_id}`);
        return {
          name: e?.driver?.full_name ?? "",
          slug: e?.driver?.slug ?? null,
          flag: flagEmoji(e?.driver?.nationality ?? null),
          points: Number(r.points ?? 0),
        };
      };

      titleRace = {
        year: f2Season.year,
        roundsDone,
        totalRounds: weekends.length || null,
        finale: last
          ? { name: last.name, date: fmtDayRange(last.date_from, last.date_to) }
          : null,
        leader: raceRow(rows[0]),
        chaser: rows.length > 1 ? raceRow(rows[1]) : null,
      };
    }
  }

  const driverCount = driversRes.count ?? null;

  // Hero box meta lines, computed from the seasons on record.
  const singleMeta = (id: string): string => {
    const years = yearsByChamp.get(id) ?? [];
    if (years.length === 0) return "—";
    const n = years.length;
    return `${Math.min(...years)}–${Math.max(...years)} · ${n} season${n === 1 ? "" : "s"}`;
  };
  const f4Years = F4_CHIPS.flatMap((c) => yearsByChamp.get(c.id) ?? []);
  const f4Meta =
    f4Years.length === 0
      ? "—"
      : `${F4_CHIPS.filter((c) => (yearsByChamp.get(c.id) ?? []).length > 0).length} championships · ${f4Years.length} seasons`;
  const chipLabel = (id: string, label: string): string => {
    const years = yearsByChamp.get(id) ?? [];
    if (years.length === 0) return label;
    return `${label} ${Math.min(...years)}–${Math.max(...years)}`;
  };

  const crownYear = crowned.length > 0 ? Math.max(...crowned.map((c) => c.year)) : null;
  const showStrip = crowned.length > 0 || titleRace !== null;

  const boxes = [
    { tier: "F4", color: "#fafafa", title: "National Formula 4", meta: f4Meta, href: null as string | null, chips: true },
    { tier: "FREC", color: "#1e3a8a", title: "Formula Regional European", meta: singleMeta("freca"), href: "/championships/freca", chips: false },
    { tier: "F3", color: "#f97316", title: "FIA Formula 3", meta: singleMeta("f3"), href: "/championships/f3", chips: false },
    { tier: "F2", color: "#2563eb", title: "FIA Formula 2", meta: singleMeta("f2"), href: "/championships/f2", chips: false },
    { tier: "F1", color: "#e10600", title: "Formula 1", meta: "The destination", href: null as string | null, chips: false },
  ];

  const boxStyle = (color: string) => ({
    display: "block" as const,
    textDecoration: "none",
    color: "inherit",
    textAlign: "left" as const,
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderLeft: `3px solid ${color}`,
    borderRadius: 14,
    padding: "13px 15px",
  });

  return (
    <main>
      {/* Hero: the OG lockup with the five rungs under the chevrons */}
      <section
        aria-label="Introduction"
        style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid #1e293b" }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -160,
            right: -80,
            width: 420,
            height: 420,
            background: "radial-gradient(circle, rgba(249,115,22,0.13) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -180,
            left: -60,
            width: 460,
            height: 460,
            background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1100,
            margin: "0 auto",
            padding: "40px 1rem 52px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#94a3b8",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            The junior single-seater database
          </div>
          <h1
            style={{
              margin: "0 0 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: "clamp(38px, 7vw, 56px)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                color: "var(--text)",
              }}
            >
              Road
            </span>
            <HeroChevrons size={44} />
            <span
              style={{
                fontSize: "clamp(38px, 7vw, 56px)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                color: "var(--text)",
              }}
            >
              F1
            </span>
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: 17,
              maxWidth: 520,
              margin: "0 auto 26px",
              lineHeight: 1.6,
            }}
          >
            Every race, every driver, every point — from national F4 to the edge
            of the grid.
          </p>

          {/* The five rungs, one box per chevron above */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              maxWidth: 980,
              margin: "0 auto 28px",
            }}
          >
            {boxes.map((b) => {
              const style = boxStyle(b.color);
              const inner = (
                <>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: "-0.02em",
                      color: b.color,
                    }}
                  >
                    {b.tier}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 13,
                      marginTop: 2,
                      color: "var(--text)",
                    }}
                  >
                    {b.title}
                  </span>
                  <span
                    style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}
                  >
                    {b.meta}
                  </span>
                  {b.chips && (
                    <span style={{ display: "flex", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
                      {F4_CHIPS.map((c) => (
                        <Link
                          key={c.id}
                          href={`/championships/${c.id}`}
                          style={{
                            fontSize: 10.5,
                            color: "#94a3b8",
                            border: "1px solid #1e293b",
                            padding: "2px 7px",
                            borderRadius: 999,
                            textDecoration: "none",
                            background: "#0f172a",
                          }}
                        >
                          {chipLabel(c.id, c.label)}
                        </Link>
                      ))}
                    </span>
                  )}
                </>
              );
              return b.href ? (
                <Link key={b.tier} href={b.href} style={style}>
                  {inner}
                </Link>
              ) : (
                <div key={b.tier} style={style}>
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Search */}
          <form action="/drivers" method="get" style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
            <input
              name="q"
              type="search"
              placeholder={
                driverCount !== null ? `Search ${fmt(driverCount)} drivers…` : "Search drivers…"
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 108px 14px 18px",
                fontSize: 15,
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 14,
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                position: "absolute",
                right: 10,
                top: 9,
                background: "#f97316",
                color: "#0a0a0d",
                fontSize: 13,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Champions: computed from the database, appears as seasons end */}
      {showStrip && (
        <section aria-label="Champions">
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 1rem 56px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#f97316",
                textTransform: "uppercase",
              }}
            >
              Fresh results
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "6px 0 4px" }}>
              {crownYear ? `Crowned in ${crownYear}` : "Title races"}
            </h2>
            <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
              Every champion, verified against the officials&apos; published totals.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 12,
                marginTop: 18,
              }}
            >
              {crowned.map((c) => {
                const meta = SERIES_META[c.championshipId];
                const color = meta?.color ?? "#94a3b8";
                const short = meta?.short ?? c.championshipId;
                return (
                  <div
                    key={c.championshipId}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 16,
                      padding: 18,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: `linear-gradient(90deg, ${color}, transparent)`,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color }}>
                        {short} · {c.year}
                      </span>
                      <span style={{ fontSize: 18 }}>🏆</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 24 }}>{c.flag}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>
                      {c.slug ? (
                        <Link href={`/drivers/${c.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{c.team}</div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 800, fontSize: 20 }}>{fmt(c.points)}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        points{c.wins ? ` · ${c.wins} win${c.wins === 1 ? "" : "s"}` : ""}
                      </span>
                    </div>
                    {c.rookie && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 10,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.33)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          letterSpacing: "0.06em",
                        }}
                      >
                        ROOKIE CHAMPION
                      </span>
                    )}
                  </div>
                );
              })}

              {/* The F2 title race — live from the standings */}
              {titleRace && (
                <div
                  style={{
                    background: "linear-gradient(160deg, #1a1a2e, #0f172a)",
                    border: "1px solid rgba(37,99,235,0.4)",
                    borderRadius: 16,
                    padding: 18,
                    gridColumn: "1 / -1",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#2563eb" }}>
                        STILL TO BE DECIDED · FIA FORMULA 2 {titleRace.year}
                      </div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                        {titleRace.roundsDone != null && titleRace.totalRounds
                          ? `After ${titleRace.roundsDone}/${titleRace.totalRounds} rounds`
                          : "Live standings"}
                        {titleRace.finale && titleRace.finale.date
                          ? ` — finale: ${titleRace.finale.name} · ${titleRace.finale.date}`
                          : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24 }}>
                      {[titleRace.leader, titleRace.chaser].map((d, i) =>
                        d ? (
                          <div key={d.name} style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                              {d.flag}{" "}
                              {d.slug ? (
                                <Link
                                  href={`/drivers/${d.slug}`}
                                  style={{ color: "var(--text)", textDecoration: "none" }}
                                >
                                  {d.name}
                                </Link>
                              ) : (
                                d.name
                              )}
                              {i === 0 && <span style={{ fontSize: 10, color: "#64748b" }}> (leads)</span>}
                            </div>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: i === 0 ? "#fafafa" : "#94a3b8",
                              }}
                            >
                              {fmt(d.points)}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
