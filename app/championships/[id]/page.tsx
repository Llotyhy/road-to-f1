

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type Championship = {
  id: string;
  name: string;
  short_name: string;
  kind: string;
  tier: number | null;
  color: string | null;
};

type Season = {
  id: string;
  year: number;
  starts_on: string | null;
  ends_on: string | null;
};

type StandingRow = {
  driver_id: string;
  points: number | string;
  wins: number;
  podiums: number;
  fastest_laps: number;
};

type EntryRow = {
  driver_id: string;
  car_number: number | null;
  rookie: boolean;
  final_position: number | null;
  driver: { id: string; full_name: string; slug: string } | null;
  team: { id: string; name: string } | null;
};

type WeekendRow = {
  round: number;
  name: string;
  circuit: string | null;
  country: string | null;
  date_from: string | null;
  date_to: string | null;
  sessions: Array<{ id: string; name: string; scheduled_on: string | null }>;
};

type WinnerRow = { session_id: string; driver: { full_name: string; slug: string } | null };

const FLAGS: Record<string, string> = {
  AT: "🇦🇹", AU: "🇦🇺", BE: "🇧🇪", BR: "🇧🇷", CA: "🇨🇦", CH: "🇨🇭",
  DE: "🇩🇪", DK: "🇩🇰", ES: "🇪🇸", FR: "🇫🇷", GB: "🇬🇧", HU: "🇭🇺",
  IT: "🇮🇹", JP: "🇯🇵", MC: "🇲🇨", NL: "🇳🇱", PT: "🇵🇹", US: "🇺🇸",
  ZA: "🇿🇦",
};

function fmtDay(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function fmtRange(from: string | null, to: string | null): string {
  if (!from) return "TBC";
  if (!to) return fmtDay(from);
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  const month = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const sameMonth =
    f.getUTCFullYear() === t.getUTCFullYear() && f.getUTCMonth() === t.getUTCMonth();
  if (sameMonth) return `${f.getUTCDate()}–${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
  return `${f.getUTCDate()} ${month(f)} – ${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id.toUpperCase()} — Road to F1` };
}

export default async function ChampionshipPage({ params }: PageProps) {
  const { id } = await params;
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

  const { data: championshipData } = await supabase
    .from("championships")
    .select("id, name, short_name, kind, tier, color")
    .eq("id", id)
    .maybeSingle();
  const championship = championshipData as unknown as Championship | null;
  if (!championship) notFound();

  const { data: seasonData } = await supabase
    .from("seasons")
    .select("id, year, starts_on, ends_on")
    .eq("championship_id", id)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const season = seasonData as unknown as Season | null;

  let standings: StandingRow[] = [];
  let entries: EntryRow[] = [];
  let weekends: WeekendRow[] = [];
  const winners = new Map<string, { name: string; slug: string | null }>();

  if (season) {
    const { data: standingsData } = await supabase
      .from("v_championship_standings")
      .select("driver_id, points, wins, podiums, fastest_laps")
      .eq("season_id", season.id);
    standings = (standingsData ?? []) as unknown as StandingRow[];

    const { data: entriesData } = await supabase
      .from("season_entries")
      .select(
        "driver_id, car_number, rookie, final_position, driver:drivers(id, full_name, slug), team:teams(id, name)"
      )
      .eq("season_id", season.id);
    entries = (entriesData ?? []) as unknown as EntryRow[];

    const { data: weekendsData } = await supabase
      .from("race_weekends")
      .select("round, name, circuit, country, date_from, date_to, sessions(id, name, scheduled_on)")
      .eq("season_id", season.id)
      .order("round");
    weekends = (weekendsData ?? []) as unknown as WeekendRow[];

    const sessionIds = weekends.flatMap((w) => w.sessions.map((s) => s.id));
    if (sessionIds.length > 0) {
      const { data: winnersData } = await supabase
        .from("results")
        .select("session_id, driver:drivers(full_name, slug)")
        .eq("finish_position", 1)
        .in("session_id", sessionIds);
      for (const w of (winnersData ?? []) as unknown as WinnerRow[]) {
        if (w.driver?.full_name) {
          winners.set(w.session_id, { name: w.driver.full_name, slug: w.driver.slug ?? null });
        }
      }
    }
  }

  // Championship standings: eligible (entered) drivers only, live from results.
  const entryByDriver = new Map(entries.map((e) => [e.driver_id, e]));
  const tableRows = standings
    .map((s) => {
      const entry = entryByDriver.get(s.driver_id);
      return {
        ...s,
        points: Number(s.points ?? 0),
        entry,
        name: entry?.driver?.full_name ?? entry?.driver?.slug ?? s.driver_id,
        slug: entry?.driver?.slug ?? null,
        team: entry?.team?.name ?? "",
        car: entry?.car_number ?? null,
        finalPosition: entry?.final_position ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        (a.finalPosition ?? 999) - (b.finalPosition ?? 999)
    );

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

  return (
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: 14 }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none" }}>
          ← Road to F1
        </Link>
      </p>

      <h1 style={{ marginBottom: 4 }}>
        <span style={{ color: championship.color ?? undefined }}>
          {championship.short_name}
        </span>{" "}
        {season ? season.year : ""}
      </h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        {championship.name}
        {season ? ` · ${fmtRange(season.starts_on, season.ends_on)}` : ""}
      </p>

      {!season && <p>No season ingested for this championship yet.</p>}

      {season && tableRows.length > 0 && (
        <section aria-label="Championship standings">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Standings</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Pos</th>
                <th style={th}>Driver</th>
                <th style={th}>Team</th>
                <th style={{ ...th, ...num }}>Car</th>
                <th style={{ ...th, ...num }}>Points</th>
                <th style={{ ...th, ...num }}>Wins</th>
                <th style={{ ...th, ...num }}>Podiums</th>
                <th style={{ ...th, ...num }}>FLs</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={r.driver_id}>
                  <td style={td}>{r.finalPosition ?? i + 1}</td>
                  <td style={td}>
                    <strong>
                      {r.slug ? (
                        <Link href={`/drivers/${r.slug}`} style={link}>
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </strong>
                    {r.entry?.rookie && (
                      <span
                        title="Rookie"
                        style={{ marginLeft: 6, fontSize: 11, color: "#f97316", border: "1px solid #f97316", borderRadius: 4, padding: "0 4px" }}
                      >
                        R
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: "#555" }}>{r.team}</td>
                  <td style={{ ...td, ...num }}>{r.car ?? "—"}</td>
                  <td style={{ ...td, ...num }}>
                    <strong>{r.points}</strong>
                  </td>
                  <td style={{ ...td, ...num }}>{r.wins}</td>
                  <td style={{ ...td, ...num }}>{r.podiums}</td>
                  <td style={{ ...td, ...num }}>{r.fastest_laps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {season && tableRows.length === 0 && (
        <p>
          No race results ingested for {season.year} yet — run a season data
          file in the Supabase SQL editor.
        </p>
      )}

      {weekends.length > 0 && (
        <section aria-label="Race calendar" style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Calendar</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Rd</th>
                <th style={th}>Date</th>
                <th style={th}>Circuit</th>
                <th style={th}>Races</th>
              </tr>
            </thead>
            <tbody>
              {weekends.map((w) => (
                <tr key={w.round}>
                  <td style={td}>{w.round}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtRange(w.date_from, w.date_to)}</td>
                  <td style={td}>
                    {w.country ? `${FLAGS[w.country] ?? ""} ` : ""}
                    {w.name}
                    {w.circuit ? (
                      <span style={{ color: "#777" }}> — {w.circuit}</span>
                    ) : null}
                  </td>
                  <td style={td}>
                    {[...w.sessions]
                      .sort((a, b) =>
                        (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? "") ||
                        a.name.localeCompare(b.name)
                      )
                      .map((s) => {
                        const winner = winners.get(s.id);
                        return (
                          <div key={s.id}>
                            {s.name} —{" "}
                            {winner ? (
                              <strong>
                                {winner.slug ? (
                                  <Link href={`/drivers/${winner.slug}`} style={link}>
                                    {winner.name}
                                  </Link>
                                ) : (
                                  winner.name
                                )}
                              </strong>
                            ) : (
                              <span style={{ color: "#999" }}>no result yet</span>
                            )}{" "}
                            <span style={{ color: "#999", fontSize: 12 }}>
                              ({fmtDay(s.scheduled_on)})
                            </span>
                          </div>
                        );
                      })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

