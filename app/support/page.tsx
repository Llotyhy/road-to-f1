import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support the site",
  description:
    "Road to F1 is free and ad-free. If you like the site, here's how a small tip helps keep it running.",
  openGraph: {
    title: "Support the site — Road to F1",
    description:
      "Road to F1 is free and ad-free. If you like the site, here's how a small tip helps keep it running.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

// ─────────────────────────────────────────────────────────────
// Tip link. Swap in the real URL once the provider is chosen:
//   Ko-fi:     "https://ko-fi.com/roadtof1"
//   BMC:       "https://buymeacoffee.com/roadtof1"
//   Stripe:    your Stripe Payment Page link
// Empty string = "opening soon" state (buttons disabled, page still live).
// ─────────────────────────────────────────────────────────────
const TIP_URL = "";

type Provider = {
  name: string;
  fee: string;
  feeNote: string;
  recommended: boolean;
  pros: string[];
};

const PROVIDERS: Provider[] = [
  {
    name: "Ko-fi",
    fee: "0% on tips",
    feeNote: "No platform fee on donations; payment processor fees only.",
    recommended: true,
    pros: ["Zero platform fee", "One-off and monthly options", "Instant setup"],
  },
  {
    name: "Buy Me a Coffee",
    fee: "5% flat",
    feeNote: "5% platform fee on all support, plus payment processor fees.",
    recommended: false,
    pros: ["Polished supporter page", "One-off and monthly options", "Quick setup"],
  },
  {
    name: "Stripe Payment Page",
    fee: "~1.4% + €0.25",
    feeNote: "Standard EU card rate; you build the page yourself.",
    recommended: false,
    pros: ["Lowest fee at scale", "Full control of branding", "Requires Stripe account setup"],
  },
];

const CARD: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: "18px 20px",
};

export default function SupportPage() {
  const active = TIP_URL !== "";

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

      {/* Tip buttons / opening-soon */}
      <section style={{ ...CARD, marginBottom: 20 }}>
        {active ? (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.6 }}>
              Every tip goes straight into hosting and data costs. Thank you!
            </p>
            <a
              href={TIP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: "#f97316",
                color: "#fff",
                borderRadius: 8,
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Leave a tip
            </a>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.6 }}>
              <strong>Tipping opens soon.</strong> The page is ready — the tip provider just needs
              to be switched on.
            </p>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              In the meantime, the best support is spreading the word: share a driver page or a
              championship standings link with someone who argues about junior single-seaters.
            </p>
          </>
        )}
      </section>

      {/* Where the money goes */}
      <section style={{ ...CARD, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Where a tip goes</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#94a3b8", lineHeight: 1.8, fontSize: 14 }}>
          <li>
            <strong>Hosting.</strong> Vercel&apos;s free Hobby plan works for non-commercial sites;
            if tips ever make the site &quot;commercial&quot;, it moves to Vercel Pro ($20/month).
          </li>
          <li>
            <strong>Database.</strong> Supabase free tier so far — a tip covers headroom before
            limits bite.
          </li>
          <li>
            <strong>Domain.</strong> roadtof1.app renewal, every year.
          </li>
          <li>
            <strong>Time.</strong> Ingesting and validating results is the real cost; tips say the
            hours are worth it.
          </li>
        </ul>
      </section>

      {/* Provider comparison */}
      <section>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>How tips will be accepted</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {PROVIDERS.map((p) => (
            <div
              key={p.name}
              style={{
                ...CARD,
                ...(p.recommended
                  ? { border: "1px solid #f97316", background: "rgba(249,115,22,0.06)" }
                  : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 15 }}>{p.name}</strong>
                {p.recommended && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#f97316",
                      border: "1px solid #f97316",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    LIKELY PICK
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, margin: "10px 0 4px", color: "var(--text)" }}>
                {p.fee}
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>{p.feeNote}</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: "#94a3b8", lineHeight: 1.7, fontSize: 13 }}>
                {p.pros.map((pro) => (
                  <li key={pro}>{pro}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          Fees are indicative — check the provider&apos;s current pricing page before switching on
          the tip link.
        </p>
      </section>

      <p style={{ color: "#94a3b8", fontSize: 15, padding: "2rem 0 3rem" }}>
        Thank you for being here. Really. ♥
      </p>
    </main>
  );
}

