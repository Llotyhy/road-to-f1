

import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

  const { data: championships, error } = await supabase
    .from("championships")
    .select("id, name, short_name, kind, tier, color")
    .order("tier");

  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Road to F1</h1>
        <p>Database error: {error.message}</p>
        <p>Did you run supabase/schema.sql in the SQL editor?</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Road to F1</h1>
      <p>
        {championships?.length
          ? "Database connected. Championships on the ladder:"
          : "Database connected, but empty — run the seed section of schema.sql."}
      </p>
      <ul style={{ lineHeight: 2 }}>
        {championships?.map((c) => (
          <li key={c.id}>
            <strong style={{ color: c.color ?? undefined }}>
              <Link
                href={`/championships/${c.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {c.short_name}
              </Link>
            </strong>{" "}
            — {c.name} ({c.kind})
          </li>
        ))}
      </ul>
    </main>
  );
}

