"use client";

import { useState } from "react";
import CareerTable from "./career-table";
import type { CareerRow } from "./career-table";

export type ProfileData = {
  rows: CareerRow[];
  /** championship id -> full championship name */
  champNames: Record<string, string>;
  totals: {
    years: number;
    races: number;
    wins: number;
    podiums: number;
    fastestLaps: number;
    titles: number;
  };
  sl: {
    /** points inside the current rolling 3-year FIA window */
    windowPts: number;
    windowFrom: number;
    windowTo: number;
    /** career total, can be higher than the window */
    careerPts: number;
    /** F1 free-practice bonus points inside the window (on top of the rows above) */
    fp1Bonus: number;
  };
};

/* Site palette */
const CARD = "#0f172a";
const CARD2 = "#141d2e";
const BORDER = "#1e293b";
const MUTED = "#94a3b8";
const DIM = "#64748b";
const TEXT = "var(--text)";
const ORANGE = "#f97316";

/** The OG class colours: F4 white, FREC dark blue, F3 orange, F2 blue, F1 red.
   Anything else (external championships) renders neutral grey. */
const LADDER_COLORS: Record<string, string> = {
  f2: "#2563eb",
  f3: "#f97316",
  freca: "#1e3a8a",
  "italian-f4": "#fafafa",
  "f4-british": "#fafafa",
  "f4-spanish": "#fafafa",
  "f4-french": "#fafafa",
};

function seriesColor(championshipId: string): string {
  return LADDER_COLORS[championshipId] ?? MUTED;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

const TABS = ["Overview", "Season by season", "Ranking", "Career stats"];

export default function ProfileTabs({ data }: { data: ProfileData }) {
  const [tab, setTab] = useState(0);
  const { rows, champNames, totals, sl } = data;

  const num = (v: number | null): number => (v === null ? 0 : v);
  const titled = rows.filter((r) => r.position === 1);

  /* ---------- aggregates for the stats tab ---------- */
  const pointsRows = rows.filter((r) => r.points !== null);
  const totalPoints = pointsRows.reduce((a, r) => a + num(r.points), 0);
  const maxPts = Math.max(0, ...pointsRows.map((r) => num(r.points)));
  const rates =
    totals.races > 0
      ? [
          { v: `${Math.round((totals.wins / totals.races) * 100)}%`, label: "Win rate", note: `${totals.wins} of ${totals.races} races` },
          { v: `${Math.round((totals.podiums / totals.races) * 100)}%`, label: "Podium rate", note: `${totals.podiums} of ${totals.races} races` },
          { v: (totalPoints / totals.races).toFixed(1), label: "Points per race", note: `${totalPoints} points total` },
          { v: `${Math.round((totals.fastestLaps / totals.races) * 100)}%`, label: "Fastest-lap rate", note: `${totals.fastestLaps} of ${totals.races} races` },
        ]
      : [];

  const byChampionship = Array.from(
    rows.reduce((map, r) => {
      const cur = map.get(r.championshipId) ?? {
        shortName: r.shortName,
        color: seriesColor(r.championshipId),
        seasons: 0,
        races: 0,
        wins: 0,
        podiums: 0,
        points: 0,
        best: r.position ?? 999,
      };
      cur.seasons += 1;
      cur.races += num(r.races);
      cur.wins += num(r.wins);
      cur.podiums += num(r.podiums);
      cur.points += num(r.points);
      if (r.position !== null && r.position < cur.best) cur.best = r.position;
      map.set(r.championshipId, cur);
      return map;
    }, new Map<
      string,
      { shortName: string; color: string; seasons: number; races: number; wins: number; podiums: number; points: number; best: number }
    >()
    ).values()
  );

  const firstWinRow = rows.find((r) => num(r.wins) > 0);
  const bestRow = rows.find((r) => r.position === 1);
  const biggestRow = pointsRows.slice().sort((a, b) => num(b.points) - num(a.points))[0];
  const mostWinsRow = rows.slice().sort((a, b) => num(b.wins) - num(a.wins))[0];
  const mostFlRow = rows.slice().sort((a, b) => num(b.fastestLaps) - num(a.fastestLaps))[0];
  const records: [string, string][] = [];
  if (firstWinRow) {
    records.push([
      "First win",
      `${firstWinRow.shortName} ${firstWinRow.year}${firstWinRow.age !== null ? ` — aged ${firstWinRow.age}` : ""}`,
    ]);
  }
  if (bestRow) {
    records.push(["Best finish", `P1 — ${totals.wins} win${totals.wins === 1 ? "" : "s"} in total`]);
  } else if (rows.some((r) => r.position !== null)) {
    const bestPos = Math.min(...rows.filter((r) => r.position !== null).map((r) => r.position as number));
    records.push(["Best finish", `P${bestPos}`]);
  }
  if (biggestRow && num(biggestRow.points) > 0) {
    records.push(["Biggest season", `${biggestRow.points} pts — ${biggestRow.shortName} ${biggestRow.year}, P${biggestRow.position ?? "—"}`]);
  }
  if (mostWinsRow && num(mostWinsRow.wins) > 0) {
    records.push(["Most wins in a season", `${mostWinsRow.wins} — ${mostWinsRow.shortName} ${mostWinsRow.year}`]);
  }
  if (mostFlRow && num(mostFlRow.fastestLaps) > 0) {
    records.push(["Fastest laps in a season", `${mostFlRow.fastestLaps} — ${mostFlRow.shortName} ${mostFlRow.year}`]);
  }

  const slWindowRows = rows
    .filter((r) => r.year >= sl.windowFrom && r.year <= sl.windowTo)
    .slice()
    .reverse();

  return (
    <div>
      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 24, overflowX: "auto" }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(i)}
            style={{
              fontSize: 14,
              fontWeight: tab === i ? 700 : 500,
              color: tab === i ? TEXT : DIM,
              padding: "10px 14px",
              background: "none",
              border: "none",
              borderBottom: tab === i ? `2px solid ${ORANGE}` : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW ============ */}
      {tab === 0 && (
        <div>
          {/* stat tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 32 }}>
            {[
              [totals.races, "Races"],
              [totals.wins, "Wins"],
              [totals.podiums, "Podiums"],
              [totals.fastestLaps, "Fastest laps"],
              [sl.windowPts, "SL points"],
              [totals.titles, "Titles"],
            ].map(([v, label]) => (
              <div key={label as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>{v}</div>
                <div style={{ fontSize: 10.5, color: DIM, marginTop: 4, letterSpacing: "0.03em" }}>
                  {(label as string).toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* career ladder */}
          {rows.length > 0 && (
            <>
              <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DIM, margin: "0 0 2px" }}>
                The story
              </h2>
              <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT, margin: "0 0 4px" }}>
                Career ladder
              </h3>
              <p style={{ color: MUTED, margin: "0 0 16px", fontSize: 14 }}>
                {rows.length} season{rows.length === 1 ? "" : "s"}, {byChampionship.length} championship
                {byChampionship.length === 1 ? "" : "s"}
                {titled.length > 0 ? `, ${titled.length} title${titled.length === 1 ? "" : "s"}` : ""} — the road in one line.
              </p>
              <div style={{ overflowX: "auto", paddingBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, minWidth: rows.length > 4 ? rows.length * 160 : 0, position: "relative" }}>
                  {rows.length > 2 && (
                    <div
                      style={{
                        position: "absolute",
                        left: "4%",
                        right: "12%",
                        bottom: 92,
                        height: 2,
                        background: `linear-gradient(90deg, #22c55e66, ${ORANGE})`,
                        transform: "rotate(-3deg)",
                        transformOrigin: "left",
                      }}
                    />
                  )}
                  {rows.map((s, i) => (
                    <div
                      key={s.key}
                      style={{
                        flex: 1,
                        minWidth: 150,
                        background: s.position === 1 ? `linear-gradient(160deg, ${ORANGE}1a, ${CARD})` : CARD,
                        border: s.position === 1 ? `1px solid ${ORANGE}66` : `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: 14,
                        position: "relative",
                        marginTop: i > 0 ? i * 8 : 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>{s.year}</span>
                        {s.position === 1 && <span>🏆</span>}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: seriesColor(s.championshipId), marginTop: 6 }}>
                        {s.shortName}
                      </div>
                      <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
                        {s.multiTeams ? `${s.multiTeams.length} teams` : s.teamName || "—"}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 19,
                            color: s.position === 1 ? ORANGE : s.position === 2 || s.position === 3 ? TEXT : MUTED,
                          }}
                        >
                          {s.position !== null ? `P${s.position}` : "—"}
                        </span>
                        <span style={{ fontSize: 11, color: DIM }}>
                          {s.points !== null ? `${s.points} pts` : "no results"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* silverware */}
          {titled.length > 0 && (
            <div style={{ paddingTop: 32 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DIM, margin: "0 0 2px" }}>
                Silverware
              </h2>
              <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT, margin: "0 0 14px" }}>
                Championship titles
              </h3>
              <div style={{ display: "grid", gap: 10 }}>
                {titled.map((r) => {
                  const seasonsBefore = rows.filter(
                    (o) => o.championshipId === r.championshipId && o.year < r.year
                  ).length;
                  return (
                    <div
                      key={r.key}
                      style={{
                        background: CARD,
                        border: `1px solid ${ORANGE}44`,
                        borderRadius: 14,
                        padding: 18,
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 28 }}>🏆</span>
                      <span>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 15.5, color: TEXT }}>
                          {champNames[r.championshipId] ?? r.shortName} · {r.year}
                        </span>
                        <span style={{ display: "block", fontSize: 13, color: DIM, marginTop: 2 }}>
                          {r.multiTeams ? `${r.multiTeams.length} teams` : r.teamName} · {r.points} points ·{" "}
                          {r.rookie
                            ? "champion as a rookie"
                            : `his ${ordinal(seasonsBefore + 1)} season in the series`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SEASON BY SEASON ============ */}
      {tab === 1 && (
        <div>
          {rows.length === 0 ? (
            <p style={{ color: MUTED }}>No seasons recorded for this driver yet.</p>
          ) : (
            <div style={{ overflowX: "auto", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "6px 10px 2px" }}>
              <CareerTable rows={rows} />
            </div>
          )}
          <p style={{ color: DIM, fontSize: 13, marginTop: 12 }}>
            FT = full-time seat · PT = partial season · R = rookie season. Pos is the official
            standings position; races on record come from every result row in the database.
          </p>
        </div>
      )}

      {/* ============ RANKING ============ */}
      {tab === 2 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* Super Licence */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>FIA SUPER LICENCE</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>{sl.windowPts}</span>
                <span style={{ color: DIM, fontSize: 13 }}>/ 40 pts · {sl.windowFrom}–{sl.windowTo} window</span>
              </div>
              <div style={{ height: 8, background: CARD2, borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, (sl.windowPts / 40) * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #22c55e, #16a34a)",
                    borderRadius: 999,
                  }}
                />
              </div>
              {(slWindowRows.length > 0 || sl.fp1Bonus > 0) && (
                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  {slWindowRows.map((r) => (
                    <div key={r.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}>
                      <span>
                        {r.shortName} {r.year}
                        {r.position !== null ? ` · P${r.position}` : ""}
                      </span>
                      <span style={{ color: r.slPoints && r.slPoints > 0 ? TEXT : DIM, fontWeight: r.slPoints && r.slPoints > 0 ? 700 : 400 }}>
                        {r.slPoints && r.slPoints > 0 ? `+${r.slPoints}` : "0"}
                      </span>
                    </div>
                  ))}
                  {sl.fp1Bonus > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}>
                      <span>F1 free practice</span>
                      <span style={{ color: TEXT, fontWeight: 700 }}>+{sl.fp1Bonus}</span>
                    </div>
                  )}
                </div>
              )}
              {sl.fp1Bonus > 0 && (
                <p style={{ color: DIM, fontSize: 12, margin: "12px 0 0", lineHeight: 1.5 }}>
                  Includes +{sl.fp1Bonus} bonus point{sl.fp1Bonus === 1 ? "" : "s"} from Formula 1 free
                  practice — one per session with 100 km completed, capped at 10 per season, on top
                  of championship points (FIA Appendix L).
                </p>
              )}
              {sl.careerPts > sl.windowPts && (
                <p style={{ color: DIM, fontSize: 12, margin: "12px 0 0", lineHeight: 1.5 }}>
                  Career total {sl.careerPts} — points scored outside the three-year window no longer
                  count towards the licence.
                </p>
              )}
            </div>

            {/* Road to F1 Index — under construction */}
            <div
              style={{
                background: CARD,
                border: `1px dashed ${ORANGE}66`,
                borderRadius: 14,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: 280,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: ORANGE }}>ROAD TO F1 INDEX</div>
              <div style={{ fontSize: 34, margin: "16px 0 0" }}>🚧</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: TEXT, marginTop: 10 }}>Under construction</div>
              <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.6, margin: "8px 0 0" }}>
                Our proprietary model of every driver&apos;s chance of reaching Formula 1 — computed
                from results, progression and age curves across the whole database.
              </p>
              <p style={{ color: DIM, fontSize: 12, margin: "12px 0 0" }}>
                The method will be explained on the /rankings page when it launches.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============ CAREER STATS ============ */}
      {tab === 3 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* points per season */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM, marginBottom: 14 }}>
                POINTS PER SEASON
              </div>
              {pointsRows.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>No scored seasons yet.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
                  {pointsRows.map((r) => (
                    <div
                      key={r.key}
                      title={`${r.shortName} ${r.year}: ${r.points} pts${r.position !== null ? ` · P${r.position}` : ""}`}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}
                    >
                      <span style={{ fontSize: 10.5, color: MUTED, marginBottom: 4 }}>{r.points}</span>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 42,
                          height: `${maxPts > 0 ? Math.max(3, (num(r.points) / maxPts) * 100) : 3}%`,
                          background: seriesColor(r.championshipId),
                          borderRadius: "6px 6px 0 0",
                        }}
                      />
                      <span style={{ fontSize: 10, color: DIM, marginTop: 6, whiteSpace: "nowrap" }}>
                        {r.shortName} {String(r.year).slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {totalPoints > 0 && (
                <p style={{ color: DIM, fontSize: 12, margin: "12px 0 0" }}>
                  {totalPoints} career points — peak {maxPts}.
                </p>
              )}
            </div>

            {/* rates */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM, marginBottom: 14 }}>
                RATES
              </div>
              {rates.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>No races on record yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {rates.map((s) => (
                    <div key={s.label} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{s.v}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: DIM, marginTop: 1 }}>{s.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
            {/* by championship */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM, marginBottom: 6 }}>
                BY CHAMPIONSHIP
              </div>
              {byChampionship.map((c) => (
                <div
                  key={c.shortName + c.best}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}
                >
                  <span>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 13.5, color: c.color }}>{c.shortName}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: DIM, marginTop: 2 }}>
                      {c.seasons} season{c.seasons === 1 ? "" : "s"} · {c.races} races · {c.wins} wins · {c.podiums} podiums
                    </span>
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: c.best === 1 ? ORANGE : TEXT }}>
                    {c.best === 999 ? "—" : `P${c.best}`}
                  </span>
                </div>
              ))}
            </div>

            {/* records & firsts */}
            {records.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM, marginBottom: 6 }}>
                  RECORDS &amp; FIRSTS
                </div>
                {records.map(([l, v]) => (
                  <div
                    key={l}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}
                  >
                    <span style={{ fontSize: 12.5, color: DIM }}>{l}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
