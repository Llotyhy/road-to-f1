import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const LADDER = [
  { label: "F1", color: "#e10600", desc: "Formula 1 — the destination" },
  { label: "F2", color: "#2563eb", desc: "FIA Formula 2" },
  { label: "F3", color: "#f97316", desc: "FIA Formula 3" },
  { label: "FREC", color: "#1e3a8a", desc: "Formula Regional European" },
  { label: "F4", color: "#e2e8f0", desc: "National F4 championships" },
];

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

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

  const [{ data: championships, error: champErr }, { data: seasons }, driversRes, resultsRes] =
    await Promise.all([
      supabase.from("championships").select("id, name, short_name, kind, tier, color").order("tier"),
      supabase.from("seasons").select("championship_id, year"),
      supabase.from("drivers").select("id", { count: "exact", head: true }),
      supabase.from("results").select("session_id", { count: "exact", head: true }),
    ]);

  if (champErr) {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Road to F1</h1>
        <p>Database error: {champErr.message}</p>
        <p>Did you run supabase/schema.sql in the SQL editor?</p>
      </main>
    );
  }

  type SeasonRow = { championship_id: string; year: number };
  const seasonRows = (seasons ?? []) as unknown as SeasonRow[];
  const seasonsByChamp = new Map<string, number[]>();
  for (const s of seasonRows) {
    const list = seasonsByChamp.get(s.championship_id) ?? [];
    list.push(s.year);
    seasonsByChamp.set(s.championship_id, list);
  }

  const stats: [string, string][] = [
    [fmt(championships?.length ?? null), "championships"],
    [fmt(seasonRows.length || null), "seasons ingested"],
    [fmt(driversRes.count ?? null), "driver profiles"],
    [fmt(resultsRes.count ?? null), "race results"],
  ];

  const btn = {
    display: "inline-block",
    borderRadius: 8,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      {/* Hero */}
      <section style={{ textAlign: "center", padding: "3.5rem 0 2.5rem" }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 13,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          The junior single-seater database
        </div>
        <h1 style={{ margin: "0 0 14px", fontSize: 40, letterSpacing: "-0.02em" }}>
          Every step on the road to Formula 1
        </h1>
        <p
          style={{
            margin: "0 auto 26px",
            maxWidth: 560,
            color: "#94a3b8",
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Every race, every driver, every point — from national F4 to the edge of
          the grid. Machine-verified against official classifications.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/championships" style={{ ...btn, background: "#f97316", color: "#fff" }}>
            Browse championships
          </Link>
          <Link
            href="/drivers"
            style={{ ...btn, border: "1px solid #1e293b", color: "var(--text)" }}
          >
            Search drivers
          </Link>
        </div>
      </section>

      {/* The ladder */}
      <section aria-label="The ladder" style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          {LADDER.map((l) => (
            <div
              key={l.label}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontWeight: 700,
                  fontSize: 17,
                  color: l.color,
                  borderBottom: `3px solid ${l.color}`,
                  paddingBottom: 2,
                }}
              >
                {l.label}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>{l.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Database statistics" style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {stats.map(([n, label]) => (
            <div
              key={label}
              style={{
                flex: "1 1 150px",
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "16px 18px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Championships */}
      <section aria-label="Championships">
        <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>Championships</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {(championships ?? []).map((c) => {
            const years = seasonsByChamp.get(c.id) ?? [];
            const hasSeasons = years.length > 0;
            return (
              <Link
                key={c.id}
                href={`/championships/${c.id}`}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 12,
                  padding: 16,
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div
                  style={{
                    height: 4,
                    background: c.color ?? "#1e293b",
                    borderRadius: 2,
                    marginBottom: 12,
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                  {c.short_name}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 10px" }}>{c.name}</div>
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
    </main>
  );
}
