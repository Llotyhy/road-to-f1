import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description:
    "What Road to F1 is, what's inside the database, and where the data comes from.",
  openGraph: {
    title: "About — Road to F1",
    description:
      "What Road to F1 is, what's inside the database, and where the data comes from.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

const SECTION: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 1.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>About Road to F1</h1>
        <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
          Road to F1 is a database of junior single-seater racing: every championship on the ladder
          from F4 to F2, every driver who has raced on it, and the results behind their careers.
        </p>
      </div>

      {/* What's inside */}
      <section style={SECTION}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>What&apos;s inside</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#94a3b8", lineHeight: 1.8, fontSize: 14 }}>
          <li>Race-by-race results for every ladder season we cover</li>
          <li>Full championship standings, computed live from those results</li>
          <li>Driver career pages: teams, car numbers, rookie seasons, finishing positions</li>
          <li>FIA Super Licence points, tracked per the FIA ISC allocation tables</li>
          <li>External championships (IndyCar, Formula E, WEC, Super Formula) at standings level</li>
        </ul>
      </section>

      {/* Data sources */}
      <section style={SECTION}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Where the data comes from</h2>
        <p style={{ margin: "0 0 10px", color: "#94a3b8", lineHeight: 1.7, fontSize: 14 }}>
          Results are ingested from official championship documents — FIA PDF classifications and
          official live-timing exports — then validated and cross-checked before they enter the
          database. Where officials apply dropped-score rules, final standings follow the official
          published totals.
        </p>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7, fontSize: 14 }}>
          Spot an error? Data quality is the whole point of this site — please tell us.
        </p>
      </section>

      {/* Contact — under construction */}
      <section style={SECTION}>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Contact</h2>
        <div
          style={{
            border: "1px dashed #f9731666",
            borderRadius: 10,
            padding: "22px 20px",
          }}
        >
          <div style={{ fontSize: 26, lineHeight: 1 }}>🚧</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginTop: 10 }}>
            Under construction
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13.5, lineHeight: 1.6, margin: "8px 0 0" }}>
            A contact address for questions, corrections and data sources is on its way.
          </p>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={SECTION}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Disclaimer</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7, fontSize: 14 }}>
          Road to F1 is an unofficial fan project, built independently. It is not affiliated with,
          endorsed by, or connected to the FIA, Formula 1, or any championship or driver mentioned.
          All trademarks belong to their respective owners.
        </p>
      </section>
    </main>
  );
}
