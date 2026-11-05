import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

const BASE = "https://www.roadtof1.app";

export const dynamic = "force-dynamic";

/** Site map served at /sitemap.xml (Next.js file convention).
 *  Homepage + main nav pages + every ingested championship season +
 *  academy pages + every driver profile, straight from the database.
 *  Supabase caps each query response at 1000 rows, so every table is
 *  paged through. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/championships`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/drivers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/academies`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/rankings`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/support`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const supabase = getSupabaseAdminClient();
  if (!supabase) return urls;

  type SeasonRow = { championship_id: string; year: number; ends_on: string | null };
  const { data: seasons } = await supabase
    .from("seasons")
    .select("championship_id, year, ends_on")
    .order("championship_id")
    .order("year", { ascending: false });
  for (const s of (seasons ?? []) as unknown as SeasonRow[]) {
    urls.push({
      url: `${BASE}/championships/${s.championship_id}?year=${s.year}`,
      lastModified: s.ends_on ?? undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // Academy pages: only programmes that actually have members on the site
  // (this skips non-single-seater schemes like the AMR GT academy).
  type AcademyRow = { id: string };
  const academyIds: string[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("academies")
      .select("id")
      .order("id")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as AcademyRow[];
    for (const a of rows) academyIds.push(a.id);
    if (rows.length < 1000) break;
  }
  type MemberRow = { academy_id: string };
  const withMembers = new Set<string>();
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("academy_memberships")
      .select("academy_id")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as MemberRow[];
    for (const m of rows) withMembers.add(m.academy_id);
    if (rows.length < 1000) break;
  }
  for (const id of academyIds) {
    if (!withMembers.has(id)) continue;
    urls.push({
      url: `${BASE}/academies/${id}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  type DriverRow = { slug: string };
  const driverSlugs: string[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("drivers")
      .select("slug")
      .order("slug")
      .range(start, start + 999);
    const rows = (data ?? []) as unknown as DriverRow[];
    for (const d of rows) driverSlugs.push(d.slug);
    if (rows.length < 1000) break;
  }
  for (const slug of driverSlugs) {
    urls.push({
      url: `${BASE}/drivers/${slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return urls;
}
