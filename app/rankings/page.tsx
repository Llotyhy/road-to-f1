import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Planned rankings for Road to F1: FIA Super Licence standings, the career ladder index, and all-time winners.",
  openGraph: {
    title: "Rankings — Road to F1",
    description:
      "Planned rankings for Road to F1: FIA Super Licence standings, the career ladder index, and all-time winners.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

const PLANNED = [
  {
    title: "Super Licence standings",
    body:
      "The FIA 40-point table, computed live from every result in the database. Who is closest to an F1 Super Licence, per season and over the rolling three-year window.",
  },
  {
    title: "Career ladder index",
    body:
      "Every driver's climb in one number: how fast they moved from national F4 to the edge of the grid, weighted by championships, wins and consistency.",
  },
  {
    title: "All-time winners",
    body:
      "Most wins, podiums, poles and titles across every series the site covers — from the F2 record books to the F4 charts.",
  },
];

export default function RankingsPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 0.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Rankings</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          Numbers that put the ladder in order. These rankings are being built on
          top of the results already in the database — this page is a preview of
          what is coming.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          padding: "1rem 0 2rem",
        }}
      >
        {PLANNED.map((r) => (
          <div
            key={r.title}
            style={{
              border: "1px dashed #1e293b",
              borderRadius: 10,
              padding: "1.25rem 1.25rem 1.5rem",
              background: "#0f172a",
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#f97316",
                border: "1px solid #f97316",
                borderRadius: 999,
                padding: "2px 10px",
                marginBottom: 12,
              }}
            >
              Planned
            </span>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{r.title}</h2>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6, fontSize: 14 }}>{r.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
