import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Championships",
  description:
    "Every championship covered by Road to F1: the ladder from F4 to F2, the former series that ran their final seasons, and the GT, sportscar and oval championships beyond the ladder.",
  openGraph: {
    title: "Championships — Road to F1",
    description:
      "Every championship covered by Road to F1: the ladder from F4 to F2, the former series that ran their final seasons, and the GT, sportscar and oval championships beyond the ladder.",
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
  section: string | null;
  ended_year: number | null;
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

// Display order within each section. Championships not listed fall to the end
// of their section (tier, then name) — new SQL rows stay visible even before
// the order list is updated.
const LADDER_ORDER = [
  "f2",
  "super-formula",
  "f3",
  "macau-gp",
  "freca",
  "frme",
  "fr-americas",
  "fr-oceania",
  "italian-f4",
  "f4-british",
  "f4-spanish",
  "f4-french",
  "f4-uae",
  "f4-us",
];
const FORMER_ORDER = ["toyota-racing-series", "german-f4", "formula-renault-eurocup"];
const BEYOND_ORDER = [
  "indycar",
  "indy-nxt",
  "imsa",
  "nascar-cup",
  "formula-e",
  "gt-world-challenge-europe",
  "wec-hypercar",
  "wec-lmgt3",
];

function orderList(list: Championship[], order: string[]): Championship[] {
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return [...list].sort(
    (a, b) =>
      idx(a.id) - idx(b.id) ||
      (a.tier ?? 9) - (b.tier ?? 9) ||
      a.short_name.localeCompare(b.short_name),
  );
}

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
    supabase
      .from("championships")
      .select("id, name, short_name, kind, tier, color, section, ended_year"),
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

  // Section from the DB, with a fallback to the old kind-based grouping so a
  // freshly added championship is never invisible.
  const sect = (c: Championship) =>
    c.section ?? (c.kind === "ladder" ? "ladder" : "beyond");

  const ladder = orderList(
    all.filter((c) => sect(c) === "ladder"),
    LADDER_ORDER,
  );
  const former = orderList(
    all.filter((c) => sect(c) === "former"),
    FORMER_ORDER,
  );
  const beyond = orderList(
    all.filter((c) => sect(c) === "beyond"),
    BEYOND_ORDER,
  );

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
          const formerCard = sect(c) === "former";
          return (
            <Link key={c.id} href={`/championships/${c.id}`} style={CARD}>
              <div
                style={{
                  height: 4,
                  background: c.color ?? "#1e293b",
                  opacity: formerCard ? 0.45 : 1,
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
                  {c.kind === "ladder" ? "race-by-race" : "standings-level"}
                </span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 10px" }}>{c.name}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {hasSeasons
                  ? `${Math.min(...years)}–${Math.max(...years)} · ${years.length} season${years.length === 1 ? "" : "s"}`
                  : formerCard && c.ended_year !== null
                    ? `Ended ${c.ended_year}`
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
          The ladder from F4 to F2, race-by-race. Everything beyond it — plus the former
          series that closed — is tracked at standings level: enough for a complete Super
          Licence picture.
        </p>
      </div>
      {ladder.length > 0 &&
        section(
          "The ladder",
          "F4 → Formula Regional → F3 → F2: the rungs to the grid, plus the top series beyond F1 and Macau's crown jewel.",
          ladder,
        )}
      {former.length > 0 &&
        section(
          "Former championships",
          "The roads that closed — championships that ran their final seasons.",
          former,
        )}
      {beyond.length > 0 &&
        section(
          "Beyond the ladder",
          "GT, sportscar and oval racing — the championships outside the single-seater ladder.",
          beyond,
        )}
      {all.length === 0 && <p>No championships found yet.</p>}
    </main>
  );
}
