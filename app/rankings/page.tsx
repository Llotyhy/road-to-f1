import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

// ISR: prerendered at deploy time and refreshed hourly (plus an immediate
// refresh when /api/revalidate is pinged after an ingestion). The Super
// Licence table only changes when a season SQL runs, so caching is safe.
export const revalidate = 3600;

export const metadata: Metadata = {
  description:
    "FIA Super Licence standings, computed live from every result in the database — who is closest to a Formula 1 seat — plus what's coming next.",
  openGraph: {
    title: "Rankings — Road to F1",
    description:
      "FIA Super Licence standings, computed live from every result in the database — who is closest to a Formula 1 seat — plus what's coming next.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

type SLRow = {
  driver_id: string;
  championship_id: string;
  year: number;
  sl_points: number | string;
};

type DriverRow = {
  id: string;
  slug: string;
  full_name: string;
  nationality: string | null;
};

type SeasonRow = {
  id: string;
  championship_id: string;
};

type SeasonEntryRow = {
  season_id: string;
  final_position: number | null;
};

type StandingsRow = {
  season_id: string;
  championship_id: string;
  short_name: string;
  driver_id: string;
  points: number | null;
  wins: number | null;
  podiums: number | null;
};

type AllocationRow = {
  championship_id: string;
  position: number;
  points: number | string;
  valid_from_year: number;
  valid_to_year: number | null;
};

type BonusRow = {
  driver_id: string;
  year: number;
  points: number | string;
};

/** Compute the flag emoji from an ISO 3166-1 alpha-2 code. */
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65)
  );
}

const PLANNED = [
  {
    title: "Career ladder index",
    body: "Every driver's climb in one number: how fast they moved from national F4 to the edge of the grid, weighted by championships, wins and consistency.",
  },
  {
    title: "All-time winners",
    body: "Most wins, podiums and titles across every series the site covers — from the F2 record books to the F4 charts.",
  },
];

export default async function RankingsPage() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Rankings</h1>
        <p>
          Supabase is not configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, fill in your project URL and keys, and restart.
        </p>
      </main>
    );
  }

  // The rolling three-year FIA window: the three seasons preceding next year.
  // For a 2027 licence that is 2024-2026 — same window as the driver profiles.
  const currentYear = new Date().getUTCFullYear();
  const windowYears = [currentYear - 2, currentYear - 1, currentYear];

  // Super Licence rows for the window, paginated (PostgREST caps at 1000 rows).
  const slRows: SLRow[] = [];
  let loadError: string | null = null;
  let start = 0;
  while (true) {
    const { data, error } = await supabase
      .from("v_superlicence_season")
      .select("driver_id, championship_id, year, sl_points")
      .in("year", windowYears)
      .order("driver_id")
      .range(start, start + 999);
    if (error) {
      loadError = error.message;
      break;
    }
    const page = (data ?? []) as unknown as SLRow[];
    slRows.push(...page);
    if (page.length < 1000) break;
    start += 1000;
  }

  // F1 free-practice bonus points for the window (FIA Appendix L: one point
  // per FP1 session with 100+ km completed, up to 10 per season, awarded on
  // top of the two best championships per year). Same sl_bonus_points source
  // as the driver profiles, so the two pages can never disagree.
  const fp1ByDriverYear = new Map<string, Map<number, number>>();
  if (!loadError) {
    const { data: bonusData } = await supabase
      .from("sl_bonus_points")
      .select("driver_id, year, points")
      .eq("category", "f1_free_practice")
      .in("year", windowYears);
    for (const r of (bonusData ?? []) as unknown as BonusRow[]) {
      let byYear = fp1ByDriverYear.get(r.driver_id);
      if (!byYear) {
        byYear = new Map();
        fp1ByDriverYear.set(r.driver_id, byYear);
      }
      // Cap at 10 per season (the FIA rule) in case of overlapping rows.
      byYear.set(r.year, Math.min(10, (byYear.get(r.year) ?? 0) + Number(r.points ?? 0)));
    }
  }
  const fp1For = (driverId: string, year: number): number =>
    fp1ByDriverYear.get(driverId)?.get(year) ?? 0;

  // Per driver and year, the counted Super Licence points. FIA rule as the
  // database models it: at most two championships count per calendar year
  // (the two best results), so a driver contesting three series in one
  // season only keeps their top two scores.
  const pointsByDriverYear = new Map<string, Map<number, number[]>>();
  for (const r of slRows) {
    const pts = Number(r.sl_points ?? 0);
    let byYear = pointsByDriverYear.get(r.driver_id);
    if (!byYear) {
      byYear = new Map();
      pointsByDriverYear.set(r.driver_id, byYear);
    }
    const list = byYear.get(r.year);
    if (list) list.push(pts);
    else byYear.set(r.year, [pts]);
  }

  type Entry = {
    driverId: string;
    perYear: Record<number, number>;
    total: number;
    projected: number;
    projected26: number;
  };
  const entries: Entry[] = [];
  for (const [driverId, byYear] of pointsByDriverYear) {
    const perYear: Record<number, number> = {};
    let total = 0;
    for (const year of windowYears) {
      const list = (byYear.get(year) ?? []).sort((a, b) => b - a);
      const counted = list.slice(0, 2).reduce((a, b) => a + b, 0);
      // Practice bonuses are official points, so they fold into the year
      // columns and the total (the footnote spells this out).
      perYear[year] = counted + fp1For(driverId, year);
      total += perYear[year];
    }
    if (total > 0) {
      entries.push({ driverId, perYear, total, projected: total, projected26: 0 });
    }
  }

  // Drivers whose only window points are F1 free-practice bonuses (e.g. a
  // race driver whose junior championships all fall outside the window)
  // still belong on the board.
  for (const [driverId, byYear] of fp1ByDriverYear) {
    if (pointsByDriverYear.has(driverId)) continue;
    const perYear: Record<number, number> = {};
    let total = 0;
    for (const y of windowYears) {
      perYear[y] = byYear.get(y) ?? 0;
      total += perYear[y];
    }
    if (total <= 0) continue;
    entries.push({ driverId, perYear, total, projected: total, projected26: 0 });
  }

  // ───────────────────────────────────────────────────────────────────────
  // PROJECTIONS — what the total would be if every in-progress current-year
  // championship ended at today's standings. The FIA only awards points once
  // a championship is complete, so this is an estimate shown in its own
  // column. A season is "in progress" when none of its season_entries have a
  // final position yet (F2 2026 until the Yas Marina finale, Spanish F4
  // until its last round) — decided seasons are excluded automatically, so
  // the column fills and empties itself as seasons end.
  // ───────────────────────────────────────────────────────────────────────
  const projectedLists = new Map<string, number[]>();
  const inProgressShortNames: string[] = [];
  let projectionsBroken = false;

  if (!loadError) {
    const { data: seasonsData } = await supabase
      .from("seasons")
      .select("id, championship_id")
      .eq("year", currentYear);
    const seasons = (seasonsData ?? []) as unknown as SeasonRow[];
    const seasonIds = seasons.map((s) => s.id);

    const decidedSeasonIds = new Set<string>();
    if (seasonIds.length > 0) {
      let sStart = 0;
      while (true) {
        const { data: entriesData } = await supabase
          .from("season_entries")
          .select("season_id, final_position")
          .in("season_id", seasonIds)
          .range(sStart, sStart + 999);
        const page = (entriesData ?? []) as unknown as SeasonEntryRow[];
        for (const row of page) {
          if (row.final_position !== null) decidedSeasonIds.add(row.season_id);
        }
        if (page.length < 1000) break;
        sStart += 1000;
      }
    }
    const inProgressIds = seasonIds.filter((id) => !decidedSeasonIds.has(id));

    if (inProgressIds.length > 0) {
      const { data: standingsData } = await supabase
        .from("v_championship_standings")
        .select("season_id, championship_id, short_name, driver_id, points, wins, podiums")
        .in("season_id", inProgressIds);
      const standings = (standingsData ?? []) as unknown as StandingsRow[];

      const bySeason = new Map<string, StandingsRow[]>();
      for (const r of standings) {
        const list = bySeason.get(r.season_id);
        if (list) list.push(r);
        else bySeason.set(r.season_id, [r]);
      }

      // Latest FIA allocation version applicable to the current year, per
      // championship and position (mirrors the view's ORDER BY valid_from_year
      // DESC LIMIT 1 — later versions simply win).
      const champIds = Array.from(
        new Set(
          seasons
            .filter((s) => inProgressIds.indexOf(s.id) !== -1)
            .map((s) => s.championship_id)
        )
      );
      const allocByChamp = new Map<string, Map<number, number>>();
      if (champIds.length > 0) {
        const { data: allocData } = await supabase
          .from("sl_points_allocation")
          .select("championship_id, position, points, valid_from_year, valid_to_year")
          .in("championship_id", champIds);
        const versions = new Map<string, Map<number, { from: number; pts: number }>>();
        for (const a of (allocData ?? []) as unknown as AllocationRow[]) {
          const from = Number(a.valid_from_year);
          const to = a.valid_to_year === null ? 9999 : Number(a.valid_to_year);
          if (currentYear < from || currentYear > to) continue;
          let m = versions.get(a.championship_id);
          if (!m) {
            m = new Map();
            versions.set(a.championship_id, m);
          }
          const pos = Number(a.position);
          const existing = m.get(pos);
          if (existing === undefined || from > existing.from) {
            m.set(pos, { from, pts: Number(a.points) });
          }
        }
        for (const [champ, m] of versions) {
          const flat = new Map<number, number>();
          for (const [pos, v] of m) flat.set(pos, v.pts);
          allocByChamp.set(champ, flat);
        }
      }

      // Rank each in-progress season at its current standings (the site's
      // sort: points, wins, podiums) and award allocation points for P1-P10.
      for (const [seasonId, rows] of bySeason) {
        const champId = seasons.find((s) => s.id === seasonId)?.championship_id;
        if (!champId) continue;
        const alloc = allocByChamp.get(champId);
        if (!alloc) {
          projectionsBroken = true;
          continue;
        }
        const short = rows[0]?.short_name ?? champId;
        if (inProgressShortNames.indexOf(short) === -1) inProgressShortNames.push(short);
        const sorted = [...rows].sort(
          (a, b) =>
            Number(b.points ?? 0) - Number(a.points ?? 0) ||
            Number(b.wins ?? 0) - Number(a.wins ?? 0) ||
            Number(b.podiums ?? 0) - Number(a.podiums ?? 0)
        );
        sorted.forEach((r, idx) => {
          const pos = idx + 1;
          if (pos > 10) return;
          const pts = alloc.get(pos) ?? 0;
          if (pts <= 0) return;
          const list = projectedLists.get(r.driver_id);
          if (list) list.push(pts);
          else projectedLists.set(r.driver_id, [pts]);
        });
      }
    }
  }

  const hasProjections = projectedLists.size > 0;

  // Merge projections into the entries: the projected current-year score is
  // the best two of (official current-year points + projected points), and
  // the projected total replaces the counted current-year column in the sum.
  // The current-year F1 practice bonus is official, not projected, so it
  // rides along in the projected total too.
  for (const e of entries) {
    const list = projectedLists.get(e.driverId);
    if (!list) continue;
    const merged = [
      ...(pointsByDriverYear.get(e.driverId)?.get(currentYear) ?? []),
      ...list,
    ].sort((a, b) => b - a);
    e.projected26 = merged.slice(0, 2).reduce((a, b) => a + b, 0);
    e.projected =
      e.perYear[windowYears[0]] +
      e.perYear[windowYears[1]] +
      e.projected26 +
      fp1For(e.driverId, currentYear);
  }

  // Drivers whose only window relevance is a projection (e.g. an F2 rookie
  // leading the current season) still belong on the board. Drivers already
  // on the board through championships or practice bonuses were merged above.
  for (const [driverId, list] of projectedLists) {
    if (pointsByDriverYear.has(driverId) || fp1ByDriverYear.has(driverId)) continue;
    const projected26 = [...list].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
    if (projected26 <= 0) continue;
    const perYear: Record<number, number> = {};
    for (const y of windowYears) perYear[y] = 0;
    entries.push({ driverId, perYear, total: 0, projected: projected26, projected26 });
  }

  // Driver details for the names and links (batched .in lookups).
  const drivers = new Map<string, DriverRow>();
  const driverIds = entries.map((e) => e.driverId);
  for (let i = 0; i < driverIds.length; i += 100) {
    const { data } = await supabase
      .from("drivers")
      .select("id, slug, full_name, nationality")
      .in("id", driverIds.slice(i, i + 100));
    for (const d of (data ?? []) as unknown as DriverRow[]) {
      drivers.set(d.id, d);
    }
  }

  const named = entries
    .filter((e) => drivers.has(e.driverId))
    .map((e) => {
      const d = drivers.get(e.driverId)!;
      return {
        ...e,
        name: d.full_name,
        slug: d.slug,
        flag: d.nationality ? flagEmoji(d.nationality) : "",
      };
    });
  named.sort(
    (a, b) =>
      b.total - a.total ||
      b.perYear[currentYear] - a.perYear[currentYear] ||
      b.perYear[currentYear - 1] - a.perYear[currentYear - 1] ||
      a.name.localeCompare(b.name)
  );

  // Standard competition ranking: tied totals share a position.
  const positions = named.map((e, i) =>
    i > 0 && e.total === named[i - 1].total ? -1 : i + 1
  );
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === -1) positions[i] = positions[i - 1];
  }

  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #1e293b",
    fontSize: 12,
    letterSpacing: "0.04em",
    color: "#64748b",
    whiteSpace: "nowrap" as const,
  };
  const numTh = { ...th, textAlign: "right" as const };
  const td = {
    padding: "9px 10px",
    borderBottom: "1px solid #1e293b",
    fontSize: 14,
  };
  const numTd = { ...td, textAlign: "right" as const, whiteSpace: "nowrap" as const };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Rankings</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          Numbers that put the ladder in order — the Super Licence table shows who
          is closest to a Formula 1 seat, computed live from every result in the
          database. More rankings are on the way.
        </p>
      </div>

      {/* Super Licence standings — LIVE */}
      <section
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: "20px 22px",
          margin: "1rem 0 2rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#f97316",
            border: "1px solid #f97316",
            borderRadius: 999,
            padding: "2px 10px",
            marginBottom: 12,
          }}
        >
          Live
        </span>
        <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Super Licence standings</h2>
        <p style={{ margin: "0 0 16px", color: "#94a3b8", lineHeight: 1.6, fontSize: 14 }}>
          FIA Super Licence points over the rolling three-year window
          ({windowYears[0]}–{windowYears[2]}, the seasons preceding {currentYear + 1}).
          40 points is what the FIA requires for a Super Licence.
        </p>

        {loadError ? (
          <p style={{ color: "#f97316", fontSize: 14, margin: 0 }}>
            Could not load the standings right now — please try again in a moment.
          </p>
        ) : named.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            No Super Licence points recorded in the {windowYears[0]}–{windowYears[2]} window yet.
          </p>
        ) : (
          <div className="r2f1-tablewrap" style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: hasProjections ? 620 : 560 }}>
              <thead>
                <tr>
                  <th style={numTh}>#</th>
                  <th style={th}>Driver</th>
                  {windowYears.map((y) => (
                    <th key={y} className="r2f1-col-md" style={numTh}>{y}</th>
                  ))}
                  <th style={numTh}>Total</th>
                  {hasProjections && <th style={numTh}>Projected</th>}
                  <th style={numTh}>To 40</th>
                </tr>
              </thead>
              <tbody>
                {named.map((e, i) => {
                  const secured = e.total >= 40;
                  const projectedUp = e.projected > e.total;
                  return (
                    <tr key={e.driverId}>
                      <td style={{ ...numTd, color: "#64748b" }}>{positions[i]}</td>
                      <td style={td}>
                        <Link
                          href={`/drivers/${e.slug}`}
                          style={{ color: "#1d4ed8", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          {e.flag ? `${e.flag} ` : ""}
                          {e.name}
                        </Link>
                      </td>
                      {windowYears.map((y) => (
                        <td key={y} className="r2f1-col-md" style={{ ...numTd, color: e.perYear[y] > 0 ? "inherit" : "#334155" }}>
                          {e.perYear[y] > 0 ? e.perYear[y] : "—"}
                        </td>
                      ))}
                      <td
                        style={{
                          ...numTd,
                          fontWeight: 700,
                          color: secured ? "#f97316" : "var(--text)",
                        }}
                      >
                        {e.total > 0 ? e.total : "—"}
                      </td>
                      {hasProjections && (
                        <td
                          style={{
                            ...numTd,
                            fontWeight: 700,
                            color: projectedUp
                              ? e.projected >= 40
                                ? "#f97316"
                                : "var(--text)"
                              : "#334155",
                          }}
                        >
                          {projectedUp ? e.projected : "—"}
                        </td>
                      )}
                      <td style={{ ...numTd, color: secured ? "#f97316" : "#64748b" }}>
                        {secured ? "✓" : `−${40 - e.total}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: "#64748b", fontSize: 12.5, lineHeight: 1.7, margin: "16px 0 0" }}>
          {named.length} driver{named.length === 1 ? "" : "s"} on the board. Per FIA
          rules, at most two championships count per year; points from external
          series are included, and so are F1 free-practice bonus points — one
          point per practice session with 100 km completed, up to 10 per
          season, on top of the two championships (already folded into the
          year columns). Eligibility also requires age, mileage and FIA
          approval — this table shows points earned. The {currentYear} column
          updates live as each season ends
          {hasProjections
            ? `. Projected: what the total would be if every in-progress ${currentYear} championship (${inProgressShortNames.join(", ")}) ended at today's standings — the FIA only awards points once a championship is complete, so it is an estimate`
            : ""}
          {projectionsBroken
            ? ". One in-progress championship has no Super Licence allocation yet and is not projected"
            : ""}
          .
        </p>
      </section>

      {/* What's coming */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          paddingBottom: "2rem",
        }}
      >
        {PLANNED.map((r) => (
          <div
            key={r.title}
            style={{
              border: "1px dashed #1e293b",
              borderRadius: 10,
              padding: "1.25rem 1.25rem 1.5rem",
              background: "#0f172a",
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#f97316",
                border: "1px solid #f97316",
                borderRadius: 999,
                padding: "2px 10px",
                marginBottom: 12,
              }}
            >
              Planned
            </span>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{r.title}</h2>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6, fontSize: 14 }}>{r.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
