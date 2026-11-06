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
};

export type StandingRow = {
  key: string;
  position: number | null;
  name: string;
  slug: string | null;
  nat: string | null;
  age: number | null;
  rookie: boolean;
  teamName: string;
  races: number | null;
  points: number | null;
  wins: number | null;
  podiums: number | null;
  fastestLaps: number | null;
  slPoints: number | null;
  multiTeams: TeamStint[] | null;
};

const ROOKIE_TITLE = "Rookie season";
const SL_TITLE = "FIA Super Licence points for this season";
const SL_PROVISIONAL_TITLE =
  "Provisional Super Licence points — what the driver would earn if the season ended now (the FIA awards points only once a championship is complete)";

export default function StandingsTable({
  rows,
  slProvisional = false,
}: {
  rows: StandingRow[];
  slProvisional?: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    // .r2f1-tablewrap + the minWidth keep the wide standings readable on
    // phones: the table scrolls inside this box (not the whole page) and
    // loses its least-important columns below the breakpoints in
    // globals.css (.r2f1-col-sm: Nat, Age / .r2f1-col-md: Races, Podiums,
    // FL — the expanded stint rows carry the same classes so the columns
    // stay aligned).
    <div className="r2f1-tablewrap">
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
      <thead>
        <tr>
          <th style={th}>Pos</th>
          <th style={th}>Driver</th>
          <th title="Nationality" className="r2f1-col-sm" style={th}>
            Nat
          </th>
          <th
            title="Age at the start of the season"
            className="r2f1-col-sm"
            style={{ ...th, ...num }}
          >
            Age
          </th>
          <th style={th}>Team</th>
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
          <th
            title={slProvisional ? SL_PROVISIONAL_TITLE : SL_TITLE}
            style={{ ...th, ...num }}
          >
            SL
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isOpen = !!expanded[r.key];
          return (
            <Fragment key={r.key}>
              <tr>
                <td style={td}>{r.position ?? "—"}</td>
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
                  {r.rookie && (
                    <span
                      title={ROOKIE_TITLE}
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: "#f97316",
                        border: "1px solid #f97316",
                        borderRadius: 4,
                        padding: "0 4px",
                      }}
                    >
                      R
                    </span>
                  )}
                </td>
                <td className="r2f1-col-sm" style={td}>{r.nat || "—"}</td>
                <td className="r2f1-col-sm" style={{ ...td, ...num }}>{r.age ?? "—"}</td>
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
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.races ?? "—"}</td>
                <td style={{ ...td, ...num }}>
                  <strong>{r.points ?? "—"}</strong>
                </td>
                <td style={{ ...td, ...num }}>{r.wins ?? "—"}</td>
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.podiums ?? "—"}</td>
                <td className="r2f1-col-md" style={{ ...td, ...num }}>{r.fastestLaps ?? "—"}</td>
                <td
                  style={{ ...td, ...num }}
                  title={slProvisional ? SL_PROVISIONAL_TITLE : "FIA Super Licence points"}
                >
                  {r.slPoints && r.slPoints > 0 ? (
                    slProvisional ? (
                      <em>{r.slPoints}</em>
                    ) : (
                      r.slPoints
                    )
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
              {r.multiTeams && isOpen &&
                r.multiTeams.map((t) => (
                  <tr key={`${r.key}-${t.teamName}`}>
                    <td style={td} />
                    <td style={td} />
                    <td className="r2f1-col-sm" style={td} />
                    <td className="r2f1-col-sm" style={td} />
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {t.teamName} ({t.raceList})
                    </td>
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
