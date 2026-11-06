import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
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
    body:
      "Every driver's climb in one number: how fast they moved from national F4 to the edge of the grid, weighted by championships, wins and consistency.",
  },
  {
    title: "All-time winners",
    body:
      "Most wins, podiums and titles across every series the site covers — from the F2 record books to the F4 charts.",
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
  };
  const entries: Entry[] = [];
  for (const [driverId, byYear] of pointsByDriverYear) {
    const perYear: Record<number, number> = {};
    let total = 0;
    for (const year of windowYears) {
      const list = (byYear.get(year) ?? []).sort((a, b) => b - a);
      const counted = list.slice(0, 2).reduce((a, b) => a + b, 0);
      perYear[year] = counted;
      total += counted;
    }
    if (total > 0) entries.push({ driverId, perYear, total });
  }

  // Driver details for the names and links (batched .in lookups).
  const drivers = new Map<string, DriverRow>();
  const driverIds = Array.from(entries.map((e) => e.driverId));
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={numTh}>#</th>
                  <th style={th}>Driver</th>
                  {windowYears.map((y) => (
                    <th key={y} style={numTh}>{y}</th>
                  ))}
                  <th style={numTh}>Total</th>
                  <th style={numTh}>To 40</th>
                </tr>
              </thead>
              <tbody>
                {named.map((e, i) => {
                  const secured = e.total >= 40;
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
                        <td key={y} style={{ ...numTd, color: e.perYear[y] > 0 ? "inherit" : "#334155" }}>
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
                        {e.total}
                      </td>
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
          series (IndyCar, Formula E, Super Formula, WEC) are included. Eligibility
          also requires age, mileage and FIA approval — this table shows points
          earned. The {currentYear} column updates live as each season ends.
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
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Planned rankings for Road to F1: FIA Super Licence standings, the career ladder index, and all-time winners.",
  openGraph: {
    title: "Rankings — Road to F1",
    description:
      "Planned rankings for Road to F1: FIA Super Licence standings, the career ladder index, and all-time winners.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

const PLANNED = [
  {
    title: "Super Licence standings",
    body:
      "The FIA 40-point table, computed live from every result in the database. Who is closest to an F1 Super Licence, per season and over the rolling three-year window.",
  },
  {
    title: "Career ladder index",
    body:
      "Every driver's climb in one number: how fast they moved from national F4 to the edge of the grid, weighted by championships, wins and consistency.",
  },
  {
    title: "All-time winners",
    body:
      "Most wins, podiums, poles and titles across every series the site covers — from the F2 record books to the F4 charts.",
  },
];

export default function RankingsPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Rankings</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          Numbers that put the ladder in order. These rankings are being built on
          top of the results already in the database — this page is a preview of
          what is coming.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          padding: "1rem 0 2rem",
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
