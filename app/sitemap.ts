import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

const BASE = "https://www.roadtof1.app";

export const dynamic = "force-dynamic";

/** Site map served at /sitemap.xml (Next.js file convention).
 *  Homepage + every ingested championship season + every driver profile,
 *  straight from the database. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
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

  type DriverRow = { slug: string };
  const { data: drivers } = await supabase.from("drivers").select("slug").order("slug");
  for (const d of (drivers ?? []) as unknown as DriverRow[]) {
    urls.push({
      url: `${BASE}/drivers/${d.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return urls;
}
