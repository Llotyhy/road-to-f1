import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";

// Per-request render (the ?year= licence pills read searchParams, which
// opts the route out of the full route cache) — instead, every query below
// is cached at the data layer, keyed on the selected licence year, exactly
// like the championship pages (same "racing-data" tag, purged by
// /api/revalidate after an ingestion).
export const dynamic = "force-dynamic";

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

type PageProps = {
  searchParams: Promise<{ year?: string }>;
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

type Entry = {
  driverId: string;
  perYear: Record<number, number>;
  total: number;
  projected: number;
  projected26: number;
};

type LoadResult = {
  loadError: string | null;
  entries: Entry[];
  drivers: DriverRow[];
  inProgressShortNames: string[];
  hasProjections: boolean;
  projectionsBroken: boolean;
  earliestYear: number | null;
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

export default async function RankingsPage({ searchParams }: PageProps) {
  const { year } = await searchParams;
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

  // The licence year is the F1 season the Super Licence would be for. The
  // FIA counts the three seasons preceding it (for 2027 that is 2024-2026 —
  // the same window the page showed when it was hard-coded).
  const currentYear = new Date().getUTCFullYear();
  const defaultLicenceYear = currentYear + 1;

  // Earliest season with Super Licence points on record (Italian F4 2014
  // today) — defines the first selectable licence year.
  const loadEarliest = unstable_cache(
    async () => {
      const sb = getSupabaseAdminClient();
      if (!sb) return null;
      const { data } = await sb
        .from("v_superlicence_season")
        .select("year")
        .order("year", { ascending: true })
        .limit(1);
      const rows = (data ?? []) as unknown as { year: number }[];
      return rows.length > 0 ? Number(rows[0].year) : null;
    },
    ["rankings-page-earliest"],
    { revalidate: 3600, tags: ["racing-data"] }
  );

  // Validate ?year=: an integer licence year inside the selectable range.
  const earliestYear = await loadEarliest();
  const firstLicenceYear =
    earliestYear === null ? null : earliestYear + 3;
  const parsed = year ? Number(year) : null;
  const licenceYear =
    parsed !== null &&
    Number.isInteger(parsed) &&
    parsed >= (firstLicenceYear ?? 9999) &&
    parsed <= defaultLicenceYear
      ? parsed
      : defaultLicenceYear;
  const windowYears = [licenceYear - 3, licenceYear - 2, licenceYear - 1];
  const isDefaultView = licenceYear === defaultLicenceYear;

  // Everything the board needs, in one data-layer cache entry keyed on the
  // licence year (the window follows from it). Same shape as the
  // championship pages: per-request render, cached queries.
  const loadData = unstable_cache(
    async (
      ly: number,
      wins: number[],
      projectionsEnabled: boolean
    ): Promise<LoadResult> => {
      const sb = getSupabaseAdminClient();
      if (!sb) {
        return {
          loadError: "no-supabase",
          entries: [],
          drivers: [],
          inProgressShortNames: [],
          hasProjections: false,
          projectionsBroken: false,
          earliestYear: null,
        };
      }

      const earliest = await (async () => {
        const { data } = await sb
          .from("v_superlicence_season")
          .select("year")
          .order("year", { ascending: true })
          .limit(1);
        const rows = (data ?? []) as unknown as { year: number }[];
        return rows.length > 0 ? Number(rows[0].year) : null;
      })();

      // Super Licence rows for the window, paginated (PostgREST caps at 1000 rows).
      const slRows: SLRow[] = [];
      let loadError: string | null = null;
      let start = 0;
      while (true) {
        const { data, error } = await sb
          .from("v_superlicence_season")
          .select("driver_id, championship_id, year, sl_points")
          .in("year", wins)
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
        const { data: bonusData } = await sb
          .from("sl_bonus_points")
          .select("driver_id, year, points")
          .eq("category", "f1_free_practice")
          .in("year", wins);
        for (const r of (bonusData ?? []) as unknown as BonusRow[]) {
          let byYear = fp1ByDriverYear.get(r.driver_id);
          if (!byYear) {
            byYear = new Map();
            fp1ByDriverYear.set(r.driver_id, byYear);
          }
          // Cap at 10 per season (the FIA rule) in case of overlapping rows.
          byYear.set(
            r.year,
            Math.min(10, (byYear.get(r.year) ?? 0) + Number(r.points ?? 0))
          );
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

      const entries: Entry[] = [];
      for (const [driverId, byYear] of pointsByDriverYear) {
        const perYear: Record<number, number> = {};
        let total = 0;
        for (const year of wins) {
          const list = (byYear.get(year) ?? []).sort((a, b) => b - a);
          const counted = list.slice(0, 2).reduce((a, b) => a + b, 0);
          // Practice bonuses are official points, so they fold into the year
          // columns and the total (the footnote spells this out).
          perYear[year] = counted + fp1For(driverId, year);
          total += perYear[year];
        }
        if (total > 0) {
          entries.push({
            driverId,
            perYear,
            total,
            projected: total,
            projected26: 0,
          });
        }
      }

      // Drivers whose only window points are F1 free-practice bonuses (e.g. a
      // race driver whose junior championships all fall outside the window)
      // still belong on the board.
      for (const [driverId, byYear] of fp1ByDriverYear) {
        if (pointsByDriverYear.has(driverId)) continue;
        const perYear: Record<number, number> = {};
        let total = 0;
        for (const y of wins) {
          perYear[y] = byYear.get(y) ?? 0;
          total += perYear[y];
        }
        if (total <= 0) continue;
        entries.push({
          driverId,
          perYear,
          total,
          projected: total,
          projected26: 0,
        });
      }

      // ───────────────────────────────────────────────────────────────────────
      // PROJECTIONS — what the total would be if every in-progress current-year
      // championship ended at today's standings. The FIA only awards points once
      // a championship is complete, so this is an estimate shown in its own
      // column. A season is "in progress" when none of its season_entries have
      // a final position yet (F2 2026 until the Yas Marina finale, Spanish F4
      // until its last round) — decided seasons are excluded automatically, so
      // the column fills and empties itself as seasons end. Historical windows
      // are complete by definition, so only the default view projects.
      // ───────────────────────────────────────────────────────────────────────
      const projectedLists = new Map<string, number[]>();
      const inProgressShortNames: string[] = [];
      let projectionsBroken = false;

      if (!loadError && projectionsEnabled) {
        const lastWindowYear = wins[wins.length - 1];
        const { data: seasonsData } = await sb
          .from("seasons")
          .select("id, championship_id")
          .eq("year", lastWindowYear);
        const seasons = (seasonsData ?? []) as unknown as SeasonRow[];
        const seasonIds = seasons.map((s) => s.id);

        const decidedSeasonIds = new Set<string>();
        if (seasonIds.length > 0) {
          let sStart = 0;
          while (true) {
            const { data: entriesData } = await sb
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
        const inProgressIds = seasonIds.filter(
          (id) => !decidedSeasonIds.has(id)
        );

        if (inProgressIds.length > 0) {
          const { data: standingsData } = await sb
            .from("v_championship_standings")
            .select(
              "season_id, championship_id, short_name, driver_id, points, wins, podiums"
            )
            .in("season_id", inProgressIds);
          const standings = (standingsData ?? []) as unknown as StandingsRow[];

          const bySeason = new Map<string, StandingsRow[]>();
          for (const r of standings) {
            const list = bySeason.get(r.season_id);
            if (list) list.push(r);
            else bySeason.set(r.season_id, [r]);
          }

          // Latest FIA allocation version applicable to the window's last
          // year, per championship and position (mirrors the view's
          // ORDER BY valid_from_year DESC LIMIT 1 — later versions simply win).
          const champIds = Array.from(
            new Set(
              seasons
                .filter((s) => inProgressIds.indexOf(s.id) !== -1)
                .map((s) => s.championship_id)
            )
          );
          const allocByChamp = new Map<string, Map<number, number>>();
          if (champIds.length > 0) {
            const { data: allocData } = await sb
              .from("sl_points_allocation")
              .select(
                "championship_id, position, points, valid_from_year, valid_to_year"
              )
              .in("championship_id", champIds);
            const versions = new Map<
              string,
              Map<number, { from: number; pts: number }>
            >();
            for (const a of (allocData ?? []) as unknown as AllocationRow[]) {
              const from = Number(a.valid_from_year);
              const to =
                a.valid_to_year === null ? 9999 : Number(a.valid_to_year);
              if (lastWindowYear < from || lastWindowYear > to) continue;
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
            if (inProgressShortNames.indexOf(short) === -1)
              inProgressShortNames.push(short);
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

      // Merge projections into the entries: the projected last-year score is
      // the best two of (official last-year points + projected points), and
      // the projected total replaces the counted last-year column in the sum.
      // The last-year F1 practice bonus is official, not projected, so it
      // rides along in the projected total too.
      if (projectionsEnabled) {
        const lastWindowYear = wins[wins.length - 1];
        for (const e of entries) {
          const list = projectedLists.get(e.driverId);
          if (!list) continue;
          const merged = [
            ...(pointsByDriverYear.get(e.driverId)?.get(lastWindowYear) ?? []),
            ...list,
          ].sort((a, b) => b - a);
          e.projected26 = merged.slice(0, 2).reduce((a, b) => a + b, 0);
          e.projected =
            e.perYear[wins[0]] +
            e.perYear[wins[1]] +
            e.projected26 +
            fp1For(e.driverId, lastWindowYear);
        }

        // Drivers whose only window relevance is a projection (e.g. an F2
        // rookie leading the current season) still belong on the board.
        // Drivers already on the board through championships or practice
        // bonuses were merged above.
        for (const [driverId, list] of projectedLists) {
          if (pointsByDriverYear.has(driverId) || fp1ByDriverYear.has(driverId))
            continue;
          const projected26 = [...list]
            .sort((a, b) => b - a)
            .slice(0, 2)
            .reduce((a, b) => a + b, 0);
          if (projected26 <= 0) continue;
          const perYear: Record<number, number> = {};
          for (const y of wins) perYear[y] = 0;
          entries.push({
            driverId,
            perYear,
            total: 0,
            projected: projected26,
            projected26,
          });
        }
      }

      // Driver details for the names and links (batched .in lookups).
      const drivers = new Map<string, DriverRow>();
      const driverIds = entries.map((e) => e.driverId);
      for (let i = 0; i < driverIds.length; i += 100) {
        const { data } = await sb
          .from("drivers")
          .select("id, slug, full_name, nationality")
          .in("id", driverIds.slice(i, i + 100));
        for (const d of (data ?? []) as unknown as DriverRow[]) {
          drivers.set(d.id, d);
        }
      }

      return {
        loadError,
        entries,
        drivers: Array.from(drivers.values()),
        inProgressShortNames,
        hasProjections,
        projectionsBroken,
        earliestYear: earliest,
      };
    },
    ["rankings-page", String(licenceYear)],
    { revalidate: 3600, tags: ["racing-data"] }
  );

  const loaded = await loadData(licenceYear, windowYears, isDefaultView);
  const loadError = loaded.loadError;
  const inProgressShortNames = loaded.inProgressShortNames;
  const hasProjections = loaded.hasProjections;
  const projectionsBroken = loaded.projectionsBroken;

  const drivers = new Map(loaded.drivers.map((d) => [d.id, d]));

  const named = loaded.entries
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
      (b.perYear[windowYears[2]] ?? 0) - (a.perYear[windowYears[2]] ?? 0) ||
      (b.perYear[windowYears[1]] ?? 0) - (a.perYear[windowYears[1]] ?? 0) ||
      a.name.localeCompare(b.name)
  );

  // Standard competition ranking: tied totals share a position.
  const positions = named.map((e, i) =>
    i > 0 && e.total === named[i - 1].total ? -1 : i + 1
  );
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === -1) positions[i] = positions[i - 1];
  }

  // Licence-year pills: every year whose three-season window is inside the
  // points on record, plus the default (next year) view.
  const pillYears: number[] = [];
  const first = loaded.earliestYear === null ? null : loaded.earliestYear + 3;
  if (first !== null) {
    for (let y = first; y <= defaultLicenceYear; y++) pillYears.push(y);
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
          {isDefaultView ? (
            <>
              FIA Super Licence points over the rolling three-year window
              ({windowYears[0]}–{windowYears[2]}, the seasons preceding {licenceYear}).
              40 points is what the FIA requires for a Super Licence.
            </>
          ) : (
            <>
              FIA Super Licence points for the {licenceYear} season —
              championships completed in {windowYears[0]}–{windowYears[2]}.
              40 points is what the FIA requires for a Super Licence.
            </>
          )}
        </p>

        {/* Licence-year switcher — same window the FIA would have counted
            for that season's licence. */}
        {pillYears.length > 1 && (
          <nav
            aria-label="Licence year"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 16px", alignItems: "center" }}
          >
            {pillYears.map((y) => {
              const active = y === licenceYear;
              return (
                <Link
                  key={y}
                  href={y === defaultLicenceYear ? "/rankings" : `/rankings?year=${y}`}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 999,
                    fontSize: 14,
                    textDecoration: "none",
                    border: `1px solid ${active ? "#f97316" : "#1e293b"}`,
                    color: active ? "#fff" : "#94a3b8",
                    background: active ? "#f97316" : "transparent",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {y}
                </Link>
              );
            })}
          </nav>
        )}

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
          approval — this table shows points earned.
          {isDefaultView ? (
            <>
              {" "}The {windowYears[2]} column
              updates live as each season ends
              {hasProjections
                ? `. Projected: what the total would be if every in-progress ${windowYears[2]} championship (${inProgressShortNames.join(", ")}) ended at today's standings — the FIA only awards points once a championship is complete, so it is an estimate`
                : ""}
              {projectionsBroken
                ? ". One in-progress championship has no Super Licence allocation yet and is not projected"
                : ""}
              .
            </>
          ) : (
            <>
              {" "}The FIA counts the three
              seasons preceding the {licenceYear} one — this window is
              complete, so the totals are final.
            </>
          )}
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
