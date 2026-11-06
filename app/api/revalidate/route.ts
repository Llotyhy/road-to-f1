// On-demand cache purge. Pinging this route after running a season SQL (or
// any other data change) refreshes every cached page immediately, instead
// of waiting up to an hour for the ISR timers: the racing-data tag covers
// the unstable_cache data loaders (championship pages, the drivers index,
// the sitemap), and the revalidatePath calls purge the ISR'd full-route
// caches (home, rankings, the index pages, every driver profile and
// academy page).
//
// GET or POST both work — pasting the URL in a browser right after an
// ingestion is the intended workflow:
//   /api/revalidate
//
// Optional hardening: set REVALIDATE_SECRET in the Vercel environment and
// call /api/revalidate?secret=<value>. Without the env var the endpoint is
// open — the worst an outsider can do is force a re-render.
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

function purge(): Response {
  revalidatePath("/", "layout");
  revalidatePath("/drivers/[slug]", "page");
  revalidatePath("/championships/[id]", "page");
  revalidatePath("/academies/[id]", "page");
  revalidateTag("racing-data");
  return Response.json({ ok: true, revalidated: true, now: new Date().toISOString() });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    const provided = new URL(request.url).searchParams.get("secret");
    if (provided !== secret) {
      return Response.json({ ok: false, error: "invalid secret" }, { status: 401 });
    }
  }
  return purge();
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
