import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

type Driver = {
  id: string;
  slug: string;
  full_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  place_of_birth: string | null;
  headshot_url: string | null;
  notes: string | null;
};

type CareerRow = {
  year: number;
  championship_id: string;
  short_name: string;
  tier: number | null;
  team_id: string | null;
  car_number: number | null;
  rookie: boolean;
  final_position: number | null;
};

type StatRow = {
  championship_id: string;
  year: number;
  points: number | string;
  wins: number;
  podiums: number;
  fastest_laps: number;
};

type Team = { id: string; name: string };

/** Compute the flag emoji from an ISO 3166-1 alpha-2 code. */
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65)
  );
}

/** Full country name from an ISO code, with a safe fallback. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function fmtDob(dob: string | null): string {
  if (!dob) return "";
  return new Date(dob + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function calcAge(dob: string): number {
  const d = new Date(dob + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, " ")} — Road to F1` };
}

export default async function DriverPage({ params }: PageProps) {
  const { slug } = await params;
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

  const { data: driverData } = await supabase
    .from("drivers")
    .select("id, slug, full_name, date_of_birth, nationality, place_of_birth, headshot_url, notes")
    .eq("slug", slug)
    .maybeSingle();
  const driver = driverData as unknown as Driver | null;
  if (!driver) notFound();

  const { data: careerData } = await supabase
    .from("v_driver_career")
    .select("year, championship_id, short_name, tier, team_id, car_number, rookie, final_position")
    .eq("driver_id", driver.id);
  const career = ((careerData ?? []) as unknown as CareerRow[]).sort((a, b) => a.year - b.year);

  const { data: statsData } = await supabase
    .from("v_championship_standings")
    .select("championship_id, year, points, wins, podiums, fastest_laps")
    .eq("driver_id", driver.id);
  const stats = (statsData ?? []) as unknown as StatRow[];

  const teamIds = Array.from(
    new Set(career.map((c) => c.team_id).filter((t): t is string => !!t))
  );
  const teams = new Map<string, string>();
  if (teamIds.length > 0) {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);
    for (const t of (teamsData ?? []) as unknown as Team[]) {
      teams.set(t.id, t.name);
    }
  }

  const rows = career.map((c) => {
    const stat = stats.find(
      (s) => s.year === c.year && s.championship_id === c.championship_id
    );
    return {
      ...c,
      team: c.team_id ? teams.get(c.team_id) ?? "" : "",
      points: stat ? Number(stat.points ?? 0) : null,
      wins: stat?.wins ?? null,
      podiums: stat?.podiums ?? null,
    };
  });

  // Career totals across all championships
  const totals = {
    seasons: career.length,
    wins: stats.reduce((a, s) => a + (s.wins ?? 0), 0),
    podiums: stats.reduce((a, s) => a + (s.podiums ?? 0), 0),
    fastestLaps: stats.reduce((a, s) => a + (s.fastest_laps ?? 0), 0),
  };

  const flag = driver.nationality ? flagEmoji(driver.nationality) : "";
  const natLine = driver.nationality
    ? `${flag} ${countryName(driver.nationality)}`
    : "";

  let bornLine = "";
  if (driver.date_of_birth && driver.place_of_birth) {
    bornLine = `Born ${fmtDob(driver.date_of_birth)} (${calcAge(driver.date_of_birth)} years old) in ${driver.place_of_birth}`;
  } else if (driver.date_of_birth) {
    bornLine = `Born ${fmtDob(driver.date_of_birth)} (${calcAge(driver.date_of_birth)} years old)`;
  } else if (driver.place_of_birth) {
    bornLine = `Born in ${driver.place_of_birth}`;
  }

  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #ddd",
    fontSize: 13,
    color: "#888",
  };
  const td = {
    padding: "8px 10px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top" as const,
  };
  const num = { textAlign: "right" as const };
  const link = { color: "#1d4ed8", textDecoration: "none" } as const;

  const statBox = {
    flex: "1 1 0",
    minWidth: 120,
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: "10px 14px",
  } as const;

  return (
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: 14 }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          ← Road to F1
        </Link>
      </p>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 8,
        }}
      >
        {driver.headshot_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driver.headshot_url}
            alt=""
            width={72}
            height={72}
            style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e5e5" }}
          />
        )}
        <div>
          <h1 style={{ marginBottom: 2 }}>
            {flag && (
              <span aria-label={driver.nationality ?? undefined} style={{ marginRight: 8 }}>
                {flag}
              </span>
            )}
            {driver.full_name}
          </h1>
          {natLine && (
            <p style={{ margin: "2px 0", color: "#555", fontSize: 15 }}>{natLine}</p>
          )}
          {bornLine && (
            <p style={{ margin: "2px 0", color: "#555", fontSize: 15 }}>{bornLine}</p>
          )}
        </div>
      </header>

      {driver.notes && <p style={{ color: "#555", marginTop: 12 }}>{driver.notes}</p>}

      {totals.seasons > 0 && (
        <section aria-label="Career totals" style={{ display: "flex", gap: 10, marginTop: "1.25rem", flexWrap: "wrap" }}>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Seasons</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.seasons}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Wins</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.wins}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Podiums</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.podiums}</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#888" }}>Fastest laps</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.fastestLaps}</div>
          </div>
        </section>
      )}

      <section aria-label="Career ladder" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Career</h2>
        {rows.length === 0 ? (
          <p>No seasons recorded for this driver yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Year</th>
                <th style={th}>Championship</th>
                <th style={th}>Team</th>
                <th style={{ ...th, ...num }}>Car</th>
                <th style={{ ...th, ...num }}>Pos</th>
                <th style={{ ...th, ...num }}>Points</th>
                <th style={{ ...th, ...num }}>Wins</th>
                <th style={{ ...th, ...num }}>Podiums</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.championship_id}-${r.year}`}>
                  <td style={td}>{r.year}</td>
                  <td style={td}>
                    <Link href={`/championships/${r.championship_id}`} style={link}>
                      {r.short_name}
                    </Link>
                    {r.rookie && (
                      <span
                        title="Rookie season"
                        style={{ marginLeft: 6, fontSize: 11, color: "#f97316", border: "1px solid #f97316", borderRadius: 4, padding: "0 4px" }}
                      >
                        R
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: "#555" }}>{r.team || "—"}</td>
                  <td style={{ ...td, ...num }}>{r.car_number ?? "—"}</td>
                  <td style={{ ...td, ...num }}>
                    {r.final_position ? <strong>{r.final_position}</strong> : "—"}
                  </td>
                  <td style={{ ...td, ...num }}>{r.points ?? "—"}</td>
                  <td style={{ ...td, ...num }}>{r.wins ?? "—"}</td>
                  <td style={{ ...td, ...num }}>{r.podiums ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
