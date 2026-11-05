import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type AcademyRow = {
  id: string;
  name: string;
  f1_team: string | null;
  color: string | null;
  established: number | null;
  blurb: string | null;
  f1_graduates: { name: string; since: number }[] | null;
};
type DriverRow = { id: string; slug: string; full_name: string; nationality: string | null };
type MemberRow = {
  driver_id: string;
  academy_id: string;
  joined_on: string | null;
  left_on: string | null;
  note: string | null;
};
type CareerRow = {
  slug: string;
  year: number;
  short_name: string;
  tier: number | null;
  final_position: number | null;
};

function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳";
  const upper = code.toUpperCase();
  return (
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + upper.charCodeAt(1) - 65)
  );
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? null : y;
}

/** Supabase caps every query response at 1000 rows by default; page
 *  through in batches so every row is actually fetched. */
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
      .select("driver_id, academy_id, joined_on, left_on, note")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as MemberRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function fetchCareerRows(
  supabase: SupabaseClient,
  slugs: string[]
): Promise<CareerRow[]> {
  if (slugs.length === 0) return [];
  const all: CareerRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("v_driver_career")
      .select("slug, year, short_name, tier, final_position")
      .in("slug", slugs)
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as CareerRow[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let title = "Academy";
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("academies")
      .select("name")
      .eq("id", id)
      .limit(1);
    const rows = (data ?? []) as unknown as { name: string }[];
    if (rows.length > 0) title = rows[0].name;
  }
  return {
    title,
    description:
      "Members on the ladder right now, alumni in the database, and every Formula 1 graduate — on Road to F1.",
    openGraph: {
      title: `${title} — Road to F1`,
      description:
        "Members on the ladder right now, alumni in the database, and every Formula 1 graduate — on Road to F1.",
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
  };
}

export default async function AcademyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Academy</h1>
        <p>Supabase is not configured yet.</p>
      </main>
    );
  }

  const { data: academyData } = await supabase
    .from("academies")
    .select("id, name, f1_team, color, established, blurb, f1_graduates")
    .eq("id", id)
    .limit(1);
  const academyRows = (academyData ?? []) as unknown as AcademyRow[];
  const academy = academyRows[0];

  if (!academy) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Academy</h1>
        <p>This academy could not be found.</p>
        <p>
          <Link href="/academies" style={{ color: "#f97316" }}>
            ← All academies
          </Link>
        </p>
      </main>
    );
  }

  const [drivers, memberships] = await Promise.all([
    fetchAllDrivers(supabase),
    fetchAllMemberships(supabase),
  ]);

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const rows = memberships
    .filter((m) => m.academy_id === academy.id)
    .map((m) => ({ ...m, driver: driverById.get(m.driver_id) }))
    .filter((m) => Boolean(m.driver));

  const current = rows.filter((m) => !m.left_on);
  const alumni = rows.filter((m) => m.left_on);
  const grads = academy.f1_graduates ?? [];

  const careerRows = await fetchCareerRows(
    supabase,
    rows.map((m) => m.driver!.slug)
  );
  const careerBySlug = new Map<string, CareerRow[]>();
  for (const r of careerRows) {
    const list = careerBySlug.get(r.slug) ?? [];
    list.push(r);
    careerBySlug.set(r.slug, list);
  }

  // Latest covered season per member: most recent year, lowest tier wins ties.
  const latestBySlug = new Map<string, CareerRow>();
  for (const [slug, list] of careerBySlug) {
    const sorted = [...list].sort(
      (x, y) => y.year - x.year || (x.tier ?? 9) - (y.tier ?? 9)
    );
    if (sorted.length > 0) latestBySlug.set(slug, sorted[0]);
  }

  const members = current
    .map((m) => {
      const latest = latestBySlug.get(m.driver!.slug);
      return {
        slug: m.driver!.slug,
        fullName: m.driver!.full_name,
        flag: flagEmoji(m.driver!.nationality ?? ""),
        joined: yearOf(m.joined_on),
        latest: latest ?? null,
      };
    })
    .sort(
      (a, b) =>
        (a.latest?.tier ?? 9) - (b.latest?.tier ?? 9) ||
        (b.latest?.year ?? 0) - (a.latest?.year ?? 0) ||
        a.fullName.localeCompare(b.fullName)
    );

  const alumniRows = alumni
    .map((m) => ({
      slug: m.driver!.slug,
      fullName: m.driver!.full_name,
      flag: flagEmoji(m.driver!.nationality ?? ""),
      joined: yearOf(m.joined_on),
      left: yearOf(m.left_on),
      note: m.note,
    }))
    .sort((a, b) => (b.left ?? 0) - (a.left ?? 0));

  // Championship titles won by anyone who has been in this programme.
  const titles = careerRows
    .filter((r) => r.final_position === 1)
    .map((r) => {
      const member = rows.find((m) => m.driver!.slug === r.slug);
      return {
        slug: r.slug,
        fullName: member?.driver?.full_name ?? r.slug,
        flag: flagEmoji(member?.driver?.nationality ?? ""),
        shortName: r.short_name,
        year: r.year,
      };
    })
    .sort((a, b) => b.year - a.year || a.fullName.localeCompare(b.fullName));

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <p style={{ margin: "0 0 10px" }}>
          <Link href="/academies" style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>
            ← All academies
          </Link>
        </p>
        <div
          style={{
            borderLeft: `4px solid ${academy.color ?? "#1e293b"}`,
            paddingLeft: 16,
          }}
        >
          <p style={{ margin: "0 0 6px", color: "#f97316", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Driver academy{academy.established ? ` · est. ${academy.established}` : ""}
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>{academy.name}</h1>
          {academy.f1_team ? (
            <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 14 }}>F1 team: {academy.f1_team}</p>
          ) : null}
          {academy.blurb ? (
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 15, lineHeight: 1.6, maxWidth: 640 }}>
              {academy.blurb}
            </p>
          ) : null}
        </div>
      </div>

      <section style={{ padding: "1.5rem 0 0" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
          On the ladder now{" "}
          <span style={{ color: "#64748b", fontSize: 14, fontWeight: 400 }}>({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No members on the covered ladder yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            {members.map((m) => (
              <div
                key={m.slug}
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  background: "#0f172a",
                  padding: "0.9rem 1rem",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ marginRight: 6 }}>{m.flag}</span>
                  <Link href={`/drivers/${m.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                    {m.fullName}
                  </Link>
                </div>
                {m.joined ? (
                  <p style={{ margin: "0 0 4px", color: "#64748b", fontSize: 12 }}>Member since {m.joined}</p>
                ) : null}
                {m.latest ? (
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                    {m.latest.short_name} {m.latest.year}
                    {m.latest.final_position === 1 ? (
                      <span style={{ color: "#f97316", fontWeight: 600 }}> · champion</span>
                    ) : null}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
                    Racing outside the covered series
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {grads.length > 0 ? (
        <section style={{ padding: "1.75rem 0 0" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
            Graduated to Formula 1{" "}
            <span style={{ color: "#64748b", fontSize: 14, fontWeight: 400 }}>({grads.length})</span>
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {grads.map((g) => (
              <span
                key={g.name}
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: 999,
                  padding: "5px 14px",
                  fontSize: 13,
                  color: "#cbd5e1",
                  background: "#0f172a",
                }}
              >
                <strong style={{ fontWeight: 600 }}>{g.name}</strong>
                <span style={{ color: "#64748b }}> · F1 since {g.since}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {alumniRows.length > 0 ? (
        <section style={{ padding: "1.75rem 0 0" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
            Alumni in the database{" "}
            <span style={{ color: "#64748b", fontSize: 14, fontWeight: 400 }}>({alumniRows.length})</span>
          </h2>
          <div style={{ border: "1px solid #1e293b", borderRadius: 10, background: "#0f172a" }}>
            {alumniRows.map((m, idx) => (
              <div
                key={m.slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  padding: "0.7rem 1rem",
                  borderTop: idx === 0 ? "none" : "1px solid #1e293b",
                }}
              >
                <span>{m.flag}</span>
                <Link
                  href={`/drivers/${m.slug}`}
                  style={{ color: "var(--text)", textDecoration: "none", fontWeight: 500, fontSize: 14 }}
                >
                  {m.fullName}
                </Link>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  {m.joined ?? "?"}–{m.left ?? "?"}
                  {m.note ? ` · ${m.note}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {titles.length > 0 ? (
        <section style={{ padding: "1.75rem 0 0" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
            Championships won in the programme{" "}
            <span style={{ color: "#64748b", fontSize: 14, fontWeight: 400 }}>({titles.length})</span>
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {titles.map((t, idx) => (
              <span
                key={idx}
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 13,
                  color: "#94a3b8",
                  background: "#0f172a",
                }}
              >
                {t.flag} <strong style={{ color: "var(--text)", fontWeight: 600 }}>{t.fullName}</strong>
                <span style={{ color: "#64748b }}> · {t.shortName} {t.year}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, padding: "1.75rem 0 2.5rem", maxWidth: 640 }}>
        Members racing outside the series this site covers (karting, GT, IndyCar) may
        not show a current rung. Membership years follow published rosters and are
        best effort where signing dates are not public.
      </p>
    </main>
  );
}

