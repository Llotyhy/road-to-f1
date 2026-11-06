import Link from "next/link";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Database",
    links: [
      { href: "/championships", label: "Championships" },
      { href: "/drivers", label: "Drivers" },
      { href: "/academies", label: "Academies" },
    ],
  },
  {
    title: "Site",
    links: [
      { href: "/about", label: "About & contact" },
      { href: "/support", label: "Support the site" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid #1e293b", marginTop: 56 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "2.5rem 1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: 48,
          color: "#94a3b8",
          fontSize: 14,
        }}
      >
        <div style={{ minWidth: 180 }}>
          <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 17 }}>
            Road <span style={{ color: "#f97316" }}>&gt;&gt;&gt;</span> F1
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, maxWidth: 260 }}>
            The junior single-seater database — results, career ladders and
            rankings on the road to Formula 1.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <b style={{ color: "var(--text)" }}>{col.title}</b>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 14 }}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 13 }}>
          <div>Built by Jasper Stringa</div>
          <div style={{ color: "#64748b", marginTop: 4, maxWidth: 260 }}>
            Unofficial fan project — not affiliated with the FIA or any championship.
          </div>
        </div>
      </div>
    </footer>
  );
}
