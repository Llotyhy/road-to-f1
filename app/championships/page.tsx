import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Championships",
  description:
    "Every championship covered by Road to F1: the F1 ladder from F4 to F2, plus the regional and external series that feed the grid.",
  openGraph: {
    title: "Championships — Road to F1",
    description:
      "Every championship covered by Road to F1: the F1 ladder from F4 to F2, plus the regional and external series that feed the grid.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

type Championship = {
  id: string;
  name: string;
  short_name: string;
  kind: string;
  tier: number | null;
  color: string | null;
};

type SeasonRow = { championship_id: string; year: number };

const CARD: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 16,
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

export default async function ChampionshipsIndex() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Championships</h1>
        <p>Supabase is not configured yet.</p>
      </main>
    );
  }

  const [{ data: championships, error }, { data: seasons }] = await Promise.all([
    supabase.from("championships").select("id, name, short_name, kind, tier, color").order("tier"),
    supabase.from("seasons").select("championship_id, year"),
  ]);

  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Championships</h1>
        <p>Database error: {error.message}</p>
      </main>
    );
  }

  const seasonRows = (seasons ?? []) as unknown as SeasonRow[];
  const seasonsByChamp = new Map<string, number[]>();
  for (const s of seasonRows) {
    const list = seasonsByChamp.get(s.championship_id) ?? [];
    list.push(s.year);
    seasonsByChamp.set(s.championship_id, list);
  }

  const all = (championships ?? []) as unknown as Championship[];
  const ladder = all.filter((c) => c.kind === "ladder");
  const beyond = all.filter((c) => c.kind !== "ladder");

  const section = (title: string, subtitle: string, list: Championship[]) => (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>{subtitle}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {list.map((c) => {
          const years = seasonsByChamp.get(c.id) ?? [];
          const hasSeasons = years.length > 0;
          return (
            <Link key={c.id} href={`/championships/${c.id}`} style={CARD}>
              <div
                style={{
                  height: 4,
                  background: c.color ?? "#1e293b",
                  borderRadius: 2,
                  marginBottom: 12,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                  {c.short_name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    border: "1px solid #1e293b",
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {c.kind === "external" ? "external" : c.kind}
                  {c.tier !== null ? ` · T${c.tier}` : ""}
                </span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 10px" }}>{c.name}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {hasSeasons
                  ? `${Math.min(...years)}–${Math.max(...years)} · ${years.length} season${years.length === 1 ? "" : "s"}`
                  : "Standings-level coverage"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 1.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Championships</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          The ladder series are covered race-by-race. External championships are ingested at
          standings level — enough for a complete Super Licence picture.
        </p>
      </div>
      {ladder.length > 0 &&
        section(
          "The ladder",
          "F4 → Formula Regional → F3 → F2 → F1: the classic path to the grid.",
          ladder,
        )}
      {beyond.length > 0 &&
        section(
          "Beyond the ladder",
          "Other F1 feeders and destinations we track for Super Licence points.",
          beyond,
        )}
      {all.length === 0 && <p>No championships found yet.</p>}
    </main>
  );
}

