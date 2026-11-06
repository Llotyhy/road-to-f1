import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "The F1 junior programmes on the Road to F1: current members on the ladder, alumni in the database, and every Formula 1 graduate.",
  openGraph: {
    title: "Academies — Road to F1",
    description:
      "The F1 junior programmes on the Road to F1: current members on the ladder, alumni in the database, and every Formula 1 graduate.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

type AcademyRow = {
  id: string;
  name: string;
  short_name: string | null;
  f1_team: string | null;
  color: string | null;
  established: number | null;
  blurb: string | null;
  f1_graduates: { name: string; since: number }[] | null;
};
type DriverRow = { id: string; slug: string; full_name: string; nationality: string | null };
type MemberRow = { driver_id: string; academy_id: string; left_on: string | null };

function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳";
  const upper = code.toUpperCase();
  return (
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(1) - 65)
  );
}

/** Supabase caps every query response at 1000 rows by default; page
 *  through in batches so every row is actually fetched. */
async function fetchAllAcademies(supabase: SupabaseClient): Promise<AcademyRow[]> {
  const all: AcademyRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("academies")
      .select("id, name, short_name, f1_team, color, established, blurb, f1_graduates")
      .order("established")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as AcademyRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function fetchAllDrivers(supabase: SupabaseClient): Promise<DriverRow[]> {
  const all: DriverRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("drivers")
      .select("id, slug, full_name, nationality")
      .order("slug")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as DriverRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function fetchAllMemberships(supabase: SupabaseClient): Promise<MemberRow[]> {
  const all: MemberRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("academy_memberships")
      .select("driver_id, academy_id, left_on")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as MemberRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

export default async function AcademiesIndex() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Academies</h1>
        <p>Supabase is not configured yet.</p>
      </main>
    );
  }

  const [academies, drivers, memberships] = await Promise.all([
    fetchAllAcademies(supabase),
    fetchAllDrivers(supabase),
    fetchAllMemberships(supabase),
  ]);

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const currentByAcademy = new Map<string, string[]>();
  for (const m of memberships) {
    if (m.left_on) continue;
    const name = driverById.get(m.driver_id)?.full_name;
    if (!name) continue;
    const list = currentByAcademy.get(m.academy_id) ?? [];
    list.push(name);
    currentByAcademy.set(m.academy_id, list);
  }

  // Only show programmes that actually have members on the site
  // (skips non-single-seater schemes like the AMR GT academy).
  const cards = academies
    .filter((a) => currentByAcademy.has(a.id) || memberships.some((m) => m.academy_id === a.id))
    .sort((a, b) => (a.established ?? 9999) - (b.established ?? 9999));

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Academies</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          The F1 junior programmes shaping the next grid. Each academy page shows who
          is on the ladder right now, the alumni already in the database, and every
          driver it has taken all the way to Formula 1.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          padding: "1rem 0 2.5rem",
        }}
      >
        {cards.map((a) => {
          const members = (currentByAcademy.get(a.id) ?? []).sort();
          const shown = members.slice(0, 6);
          const grads = a.f1_graduates ?? [];
          return (
            <div
              key={a.id}
              style={{
                border: "1px solid #1e293b",
                borderTop: `3px solid ${a.color ?? "#1e293b"}`,
                borderRadius: 10,
                background: "#0f172a",
                padding: "1.25rem 1.25rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  <Link href={`/academies/${a.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                    {a.name}
                  </Link>
                </h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
                  {a.f1_team ? `F1 team: ${a.f1_team}` : ""}
                  {a.established ? `${a.f1_team ? " · " : ""}est. ${a.established}` : ""}
                </p>
              </div>
              {a.blurb ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>{a.blurb}</p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {shown.map((name) => (
                  <span
                    key={name}
                    style={{
                      fontSize: 12,
                      color: "#cbd5e1",
                      border: "1px solid #1e293b",
                      borderRadius: 999,
                      padding: "2px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                ))}
                {members.length > shown.length ? (
                  <span style={{ fontSize: 12, color: "#64748b", padding: "2px 6px" }}>
                    +{members.length - shown.length} more
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid #1e293b",
                  paddingTop: 10,
                  marginTop: "auto",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {members.length} on the ladder · {grads.length} F1 graduates
                </span>
                <Link
                  href={`/academies/${a.id}`}
                  style={{ fontSize: 13, color: "#f97316", textDecoration: "none", fontWeight: 500 }}
                >
                  View →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

