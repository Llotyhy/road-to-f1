import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import DriverSearch from "./driver-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Search every driver in the Road to F1 database: career spans, series joined, nationalities and profiles.",
  openGraph: {
    title: "Drivers — Road to F1",
    description:
      "Search every driver in the Road to F1 database: career spans, series joined, nationalities and profiles.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export type DriverCard = {
  slug: string;
  fullName: string;
  nationality: string | null;
  flag: string;
  natName: string;
  firstYear: number | null;
  lastYear: number | null;
  seasonsCount: number;
  series: string[];
};

type DriverRow = { slug: string; full_name: string; nationality: string | null };
type CareerRow = { slug: string; year: number; short_name: string; tier: number | null };

function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳";
  const upper = code.toUpperCase();
  return (
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(1) - 65)
  );
}

function natName(code: string | null): string {
  if (!code) return "";
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const name = dn.of(code.toUpperCase());
    return typeof name === "string" && name !== code.toUpperCase() ? name : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Supabase caps every query response at 1000 rows by default; page through in
 *  batches so all drivers (and all career rows) are actually fetched. */
async function fetchAllDrivers(
  supabase: SupabaseClient
): Promise<{ data: DriverRow[]; error: string | null }> {
  const all: DriverRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("drivers")
      .select("slug, full_name, nationality")
      .order("full_name")
      .range(start, start + 999);
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as unknown as DriverRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return { data: all, error: null };
}

async function fetchAllCareerRows(supabase: SupabaseClient): Promise<CareerRow[]> {
  const all: CareerRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("v_driver_career")
      .select("slug, year, short_name, tier")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as CareerRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

/** The full driver + career dataset the grid is built from, cached at the
 *  data layer (unstable_cache, racing-data tag, one hour): the page renders
 *  per request (the ?q= deep-link seeds the client-side search), but the
 *  paged Supabase fetches below only run when the cache is cold — and
 *  /api/revalidate purges the tag right after an ingestion. */
const loadDriversIndexData = unstable_cache(
  async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;
    const [drivers, careerRows] = await Promise.all([
      fetchAllDrivers(supabase),
      fetchAllCareerRows(supabase),
    ]);
    return { drivers: drivers.data, error: drivers.error, careerRows };
  },
  ["drivers-index"],
  { revalidate: 3600, tags: ["racing-data"] }
);

export default async function DriversIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Drivers</h1>
        <p>Supabase is not configured yet.</p>
      </main>
    );
  }

  const loaded = await loadDriversIndexData();
  const drivers = loaded?.drivers ?? [];
  const error = loaded?.error ?? null;
  const careerRows = loaded?.careerRows ?? [];

  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Drivers</h1>
        <p>Database error: {error}</p>
      </main>
    );
  }

  // Aggregate career info per driver slug
  const info = new Map<string, { years: Set<number>; series: Map<string, number>; seasons: Set<string> }>();
  for (const r of careerRows) {
    const e =
      info.get(r.slug) ?? { years: new Set<number>(), series: new Map<string, number>(), seasons: new Set<string>() };
    e.years.add(r.year);
    e.seasons.add(`${r.year}-${r.short_name}`);
    // first (lowest-tier) occurrence wins so each series appears once
    if (!e.series.has(r.short_name)) e.series.set(r.short_name, r.tier ?? 9);
    info.set(r.slug, e);
  }

  const cards: DriverCard[] = drivers.map((d) => {
    const e = info.get(d.slug);
    const years = e ? Array.from(e.years) : [];
    const series = Array.from((e?.series ?? new Map<string, number>()).entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
    return {
      slug: d.slug,
      fullName: d.full_name,
      nationality: d.nationality,
      flag: d.nationality ? flagEmoji(d.nationality) : "🏳",
      natName: natName(d.nationality),
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      seasonsCount: e?.seasons.size ?? 0,
      series,
    };
  });

  const { q } = await searchParams;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Drivers</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          {cards.length} drivers in the database. Search by name, or browse the grid.
        </p>
      </div>
      <DriverSearch drivers={cards} initialQuery={q ?? ""} />
    </main>
  );
}
