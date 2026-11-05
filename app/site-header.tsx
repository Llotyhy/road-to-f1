import Link from "next/link";

/** Wordmark chevrons — the five rungs of the ladder, F4 to F1, in class
 *  colours. Matches the opengraph-image lockup. */
function WordmarkChevrons({ size = 13 }: { size?: number }) {
  const chevrons = [
    { d: "M2 1.5 L7 7 L2 12.5", color: "#fafafa" }, // F4
    { d: "M10 1.5 L15 7 L10 12.5", color: "#1e3a8a" }, // Formula Regional
    { d: "M18 1.5 L23 7 L18 12.5", color: "#f97316" }, // F3
    { d: "M26 1.5 L31 7 L26 12.5", color: "#2563eb" }, // F2
    { d: "M34 1.5 L39 7 L34 12.5", color: "#e10600" }, // F1
  ];
  return (
    <svg
      width={(size * 41) / 14}
      height={size}
      viewBox="0 0 41 14"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {chevrons.map((c) => (
        <path
          key={c.color}
          d={c.d}
          fill="none"
          stroke={c.color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

const NAV = [
  { href: "/championships", label: "Championships" },
  { href: "/drivers", label: "Drivers" },
  { href: "/academies", label: "Academies", accent: "#f97316" },
  { href: "/rankings", label: "Rankings" },
];

export default function SiteHeader() {
  return (
    <header style={{ borderBottom: "1px solid #1e293b" }}>
      <style>{`.r2f1-nav a:hover{color:var(--text)}`}</style>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0.65rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          aria-label="Road to F1 - home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--text)",
            }}
          >
            Road
            <WordmarkChevrons size={13} />
            F1
          </span>
        </Link>
        <nav
          className="r2f1-nav"
          aria-label="Main navigation"
          style={{ display: "flex", alignItems: "center", gap: 18, marginLeft: "auto", flexWrap: "wrap" }}
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontSize: 14,
                textDecoration: "none",
                color: n.accent ?? "#94a3b8",
                fontWeight: n.accent ? 600 : 400,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
