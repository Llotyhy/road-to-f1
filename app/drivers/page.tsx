import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Metadata } from "next";
import DriverSearch from "./driver-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drivers",
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

  const [{ data: drivers, error }, { data: career }] = await Promise.all([
    supabase.from("drivers").select("slug, full_name, nationality").order("full_name"),
    supabase.from("v_driver_career").select("slug, year, short_name, tier"),
  ]);

  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Drivers</h1>
        <p>Database error: {error.message}</p>
      </main>
    );
  }

  type CareerRow = { slug: string; year: number; short_name: string; tier: number | null };
  const careerRows = (career ?? []) as unknown as CareerRow[];

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

  const cards: DriverCard[] = ((drivers ?? []) as unknown as {
    slug: string;
    full_name: string;
    nationality: string | null;
  }[]).map((d) => {
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

