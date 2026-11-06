import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support the site",
  description:
    "Road to F1 is free and ad-free. Support options are on their way.",
  openGraph: {
    title: "Support the site — Road to F1",
    description:
      "Road to F1 is free and ad-free. Support options are on their way.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

const CARD: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: "18px 20px",
};

export default function SupportPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 1.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>
          Support the site <span style={{ color: "#f97316" }}>♥</span>
        </h1>
        <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
          Road to F1 is free, has no ads, and has no paywalled stats. If you find it useful, a
          small tip helps keep the lights on.
        </p>
      </div>

      {/* Under construction */}
      <section
        style={{
          ...CARD,
          border: "1px dashed #f9731666",
          padding: "28px 24px",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 34, lineHeight: 1 }}>🚧</div>
        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", marginTop: 12 }}>
          Under construction
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "10px 0 0" }}>
          Tips are coming soon. When support goes live, every contribution goes straight into
          hosting and data costs for the site.
        </p>
        <p style={{ color: "#64748b", fontSize: 12.5, lineHeight: 1.7, margin: "14px 0 0" }}>
          Until then, the site stays completely free — the best way to support it is to use it and
          share it.
        </p>
      </section>
    </main>
  );
}
