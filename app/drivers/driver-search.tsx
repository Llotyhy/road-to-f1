"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { DriverCard } from "./page";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function DriverSearch({
  drivers,
  initialQuery,
}: {
  drivers: DriverCard[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [letter, setLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter((d) => {
      if (letter && !d.fullName.toUpperCase().startsWith(letter)) return false;
      if (!q) return true;
      return (
        d.fullName.toLowerCase().includes(q) ||
        d.slug.includes(q) ||
        d.natName.toLowerCase().includes(q) ||
        d.series.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [drivers, query, letter]);

  const btn = (active: boolean): CSSProperties => ({
    border: `1px solid ${active ? "#f97316" : "#1e293b"}`,
    background: active ? "rgba(249,115,22,0.12)" : "transparent",
    color: active ? "#f97316" : "#94a3b8",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, margin: "12px 0 16px", flexWrap: "wrap" }}>
        <input
          type="search"
          value={query}
          placeholder="Search drivers, nationalities, series…"
          onChange={(e) => {
            setQuery(e.target.value);
            setLetter(null);
          }}
          style={{
            flex: "1 1 320px",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 10,
            color: "var(--text)",
            fontSize: 15,
            padding: "12px 14px",
            outline: "none",
          }}
        />
        <div style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>
          {filtered.length} of {drivers.length} drivers
        </div>
      </div>

      {/* A–Z filter */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 20,
          maxWidth: 720,
        }}
      >
        <button style={btn(letter === null)} onClick={() => setLetter(null)}>
          All
        </button>
        {LETTERS.map((L) => (
          <button key={L} style={btn(letter === L)} onClick={() => setLetter(letter === L ? null : L)}>
            {L}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No drivers match {query ? `“${query.trim()}”` : "this filter"}.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 14,
            paddingBottom: "3rem",
          }}
        >
          {filtered.map((d) => (
            <Link
              key={d.slug}
              href={`/drivers/${d.slug}`}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#1e293b",
                  color: "#94a3b8",
                  fontWeight: 700,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(d.fullName)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.flag} {d.fullName}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                  {d.natName || "Unknown"}
                  {d.firstYear !== null && d.lastYear !== null && ` · ${d.firstYear}–${d.lastYear}`}
                  {d.seasonsCount > 0 && ` · ${d.seasonsCount} season${d.seasonsCount === 1 ? "" : "s"}`}
                </div>
                {d.series.length > 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
                    {d.series.slice(0, 4).join(" · ")}
                    {d.series.length > 4 ? ` +${d.series.length - 4}` : ""}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

