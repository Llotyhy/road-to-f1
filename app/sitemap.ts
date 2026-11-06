import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";

const BASE = "https://www.roadtof1.app";

export const dynamic = "force-dynamic";

type SitemapSeason = { championship_id: string; year: number; ends_on: string | null };
type SitemapData = { seasons: SitemapSeason[]; academies: string[]; driverSlugs: string[] };

/** Site map served at /sitemap.xml (Next.js file convention).
 *  Homepage + main nav pages + every ingested championship season +
 *  academy pages + every driver profile, straight from the database.
 *  Supabase caps each query response at 1000 rows, so every table is
 *  paged through.
 *  The data assembly is cached at the data layer (unstable_cache,
 *  racing-data tag, one hour): crawlers hit /sitemap.xml often, and the
 *  paged fetches below only run when the cache is cold — /api/revalidate
 *  purges the tag right after an ingestion, so new driver pages are
 *  discovered at once. The route itself stays per-request (its XML is
 *  cheap to render from the cached data). */
const loadSitemapData = unstable_cache(
  async (): Promise<SitemapData> => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { seasons: [], academies: [], driverSlugs: [] };

    const seasonsPromise = (async () => {
      const { data } = await supabase
        .from("seasons")
        .select("championship_id, year, ends_on")
        .order("championship_id")
        .order("year", { ascending: false });
      return (data ?? []) as unknown as SitemapSeason[];
    })();

    // Academy pages: only programmes that actually have members on the site
    // (this skips non-single-seater schemes like the AMR GT academy).
    const academiesPromise = (async () => {
      const academyIds: string[] = [];
      for (let start = 0; ; start += 1000) {
        const { data } = await supabase
          .from("academies")
          .select("id")
          .order("id")
          .range(start, start + 999);
        const rows = (data ?? []) as unknown as { id: string }[];
        for (const a of rows) academyIds.push(a.id);
        if (rows.length < 1000) break;
      }
      const withMembers = new Set<string>();
      for (let start = 0; ; start += 1000) {
        const { data } = await supabase
          .from("academy_memberships")
          .select("academy_id")
          .range(start, start + 999);
        const rows = (data ?? []) as unknown as { academy_id: string }[];
        for (const m of rows) withMembers.add(m.academy_id);
        if (rows.length < 1000) break;
      }
      return academyIds.filter((id) => withMembers.has(id));
    })();

    const driversPromise = (async () => {
      const driverSlugs: string[] = [];
      for (let start = 0; ; start += 1000) {
        const { data } = await supabase
          .from("drivers")
          .select("slug")
          .order("slug")
          .range(start, start + 999);
        const rows = (data ?? []) as unknown as { slug: string }[];
        for (const d of rows) driverSlugs.push(d.slug);
        if (rows.length < 1000) break;
      }
      return driverSlugs;
    })();

    const [seasons, academies, driverSlugs] = await Promise.all([
      seasonsPromise,
      academiesPromise,
      driversPromise,
    ]);
    return { seasons, academies, driverSlugs };
  },
  ["sitemap"],
  { revalidate: 3600, tags: ["racing-data"] }
);

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

  const { seasons, academies, driverSlugs } = await loadSitemapData();

  for (const s of seasons) {
    urls.push({
      url: `${BASE}/championships/${s.championship_id}?year=${s.year}`,
      lastModified: s.ends_on ?? undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  for (const id of academies) {
    urls.push({
      url: `${BASE}/academies/${id}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
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
