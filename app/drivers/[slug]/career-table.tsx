"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

export type TeamStint = {
  teamName: string;
  raceList: string;
  races: number;
  points: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  ft: boolean;
};

export type CareerRow = {
  key: string;
  year: number;
  age: number | null;
  championshipId: string;
  shortName: string;
  rookie: boolean;
  position: number | null;
  races: number | null;
  points: number | null;
  wins: number | null;
  podiums: number | null;
  fastestLaps: number | null;
  slPoints: number | null;
  teamName: string;
  ft: boolean | null;
  multiTeams: TeamStint[] | null;
};

const ROOKIE_TITLE = "Rookie season";
const FT_TITLE =
  "Full-time — raced for the whole season (missing races through injury still counts as full-time)";
const PT_TITLE =
  "Part-time — raced only part of the season and/or stood in for another driver";

function Badge({ label, color, title }: { label: string; color: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        marginLeft: 6,
        fontSize: 11,
        color,
        border: `1px solid ${color}66`,
        borderRadius: 4,
        padding: "0 4px",
        background: `${color}12`,
      }}
    >
      {label}
    </span>
  );
}

/** All applicable badges for one season, most important first: FT -> PT -> R. */
function seasonBadges(r: CareerRow): { label: string; color: string; title: string }[] {
  const badges: { label: string; color: string; title: string }[] = [];
  if (r.multiTeams) {
    if (r.multiTeams.some((t) => t.ft)) {
      badges.push({ label: "FT", color: "#16a34a", title: FT_TITLE });
    } else {
      badges.push({ label: "PT", color: "#6b7280", title: PT_TITLE });
    }
  } else if (r.ft !== null) {
    if (r.ft) {
      badges.push({ label: "FT", color: "#16a34a", title: FT_TITLE });
    } else {
      badges.push({ label: "PT", color: "#6b7280", title: PT_TITLE });
    }
  }
  if (r.rookie) {
    badges.push({ label: "R", color: "#f97316", title: ROOKIE_TITLE });
  }
  return badges;
}

export default function CareerTable({ rows }: { rows: CareerRow[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #1e293b",
    fontSize: 12,
    letterSpacing: "0.04em",
    color: "#64748b",
  };
  const td = {
    padding: "9px 10px",
    borderBottom: "1px solid #1e293b",
    verticalAlign: "top" as const,
    fontSize: 14,
  };
  const num = { textAlign: "right" as const };
  const link = { color: "#1d4ed8", textDecoration: "none" } as const;
  const teamButton = {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    color: "#1d4ed8",
    cursor: "pointer",
    textDecoration: "none",
  } as const;

  return (
    // .r2f1-tablewrap + the minWidth keep the wide career table readable on
    // phones (scrolls inside this box, not the page) and the breakpoint
    // classes drop its least-important columns below the sizes in
    // globals.css (.r2f1-col-sm: Age / .r2f1-col-md: Races, Podiums, FL —
    // the expanded stint rows carry the same classes to stay aligned).
    <div className="r2f1-tablewrap">
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
      <thead>
        <tr>
          <th style={th}>Year</th>
          <th className="r2f1-col-sm" style={th}>
            Age
          </th>
          <th style={th}>Championship</th>
          <th style={th}>Team</th>
          <th style={{ ...th, ...num }}>Pos</th>
          <th className="r2f1-col-md" style={{ ...th, ...num }}>
            Races
          </th>
          <th style={{ ...th, ...num }}>Points</th>
          <th style={{ ...th, ...num }}>Wins</th>
          <th className="r2f1-col-md" style={{ ...th, ...num }}>
            Podiums
          </th>
          <th className="r2f1-col-md" style={{ ...th, ...num }}>
            FL
          </th>
          <th title="FIA Super Licence points for this season" style={{ ...th, ...num }}>
            SL
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isOpen = !!expanded[r.key];
          const badges = seasonBadges(r);
          return (
            <Fragment key={r.key}>
              <tr>
                <td style={td}>{r.year}</td>
                <td className="r2f1-col-sm" style={{ ...td, color: "#94a3b8" }}>{r.age ?? "—"}</td>
                <td style={td}>
                  <Link href={`/championships/${r.championshipId}?year=${r.year}`} style={link}>
                    {r.shortName}
                  </Link>
                  {badges.map((b) => (
                    <Badge key={b.label} label={b.label} color={b.color} title={b.title} />
                  ))}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {r.multiTeams ? (
                    <button
                      type="button"
                      style={teamButton}
                      onClick={() => setExpanded((prev) => ({ ...prev, [r.key]: !prev[r.key] }))}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "▾" : "▸"} {r.multiTeams.length} teams
                    </button>
                  ) : (
                    r.teamName || "—"
                  )}
                </td>
                <td style={{ ...td, ...num }}>
                  {r.position !== null ? (
                    <strong style={{ color: r.position === 1 ? "#f97316" : "inherit" }}>{r.position}</strong>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.races ?? "—"}</td>
                <td style={{ ...td, ...num }}>{r.points ?? "—"}</td>
                <td style={{ ...td, ...num }}>{r.wins ?? "—"}</td>
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.podiums ?? "—"}</td>
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.fastestLaps ?? "—"}</td>
                <td style={{ ...td, ...num }} title="FIA Super Licence points">
                  {r.slPoints && r.slPoints > 0 ? r.slPoints : "—"}
                </td>
              </tr>
              {r.multiTeams && isOpen &&
                r.multiTeams.map((t) => (
                  <tr key={`${r.key}-${t.teamName}`}>
                    <td style={td} />
                    <td className="r2f1-col-sm" style={td} />
                    <td style={td} />
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {t.teamName} ({t.raceList})
                    </td>
                    <td style={{ ...td, ...num }}>—</td>
                    <td className="r2f1-col-md" style={{ ...td, ...num }}>{t.races}</td>
                    <td style={{ ...td, ...num }}>{t.points}</td>
                    <td style={{ ...td, ...num }}>{t.wins}</td>
                    <td className="r2f1-col-md" style={{ ...td, ...num }}>{t.podiums}</td>
                    <td className="r2f1-col-md" style={{ ...td, ...num }}>{t.fastestLaps}</td>
                    <td style={{ ...td, ...num }}>—</td>
                  </tr>
                ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
