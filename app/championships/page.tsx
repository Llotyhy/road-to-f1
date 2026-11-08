import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

// ISR: prerendered at deploy time and refreshed hourly (plus an immediate
// refresh when /api/revalidate is pinged after an ingestion).
export const revalidate = 3600;

export const metadata: Metadata = {
  description:
    "Every championship covered by Road to F1: the ladder from F4 to F2, the former series that ran their final seasons, and the GT, sportscar and oval championships beyond the ladder.",
  openGraph: {
    title: "Championships — Road to F1",
    description:
      "Every championship covered by Road to F1: the ladder from F4 to F2, the former series that ran their final seasons, and the GT, sportscar and oval championships beyond the ladder.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

type Championship = {
  id: string;
  name: string;
  short_name: string;
  kind: string;
  tier: number | null;
  color: string | null;
  section: string | null;
  ended_year: number | null;
};

type SeasonRow = { championship_id: string; year: number };

const CARD: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 16,
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

// Placeholder cards for championships that are not in the database yet —
// dashed, dimmed and not clickable.
const PLACEHOLDER_CARD: CSSProperties = {
  border: "1px dashed #334155",
  borderRadius: 12,
  padding: 16,
  display: "block",
  opacity: 0.7,
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 14,
};

const CHIP: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  border: "1px solid #1e293b",
  borderRadius: 999,
  padding: "2px 8px",
  whiteSpace: "nowrap",
};

const PLANNED_CHIP: CSSProperties = {
  ...CHIP,
  color: "#64748b",
  border: "1px dashed #334155",
};

// Card abbreviations + display names for THIS page only. The DB short_name /
// name stay untouched (they feed the driver pages and the og titles); this
// map keeps the card grid in one consistent style: FREC / FRMET / FRAC /
// FRJC / FROT and F4 + country code.
const DISPLAY: Record<string, { abbr: string; name?: string }> = {
  freca: { abbr: "FREC" },
  frme: { abbr: "FRMET", name: "Formula Regional Middle East Trophy" },
  "fr-americas": { abbr: "FRAC" },
  "fr-oceania": { abbr: "FROT", name: "Formula Regional Oceania Trophy" },
  "italian-f4": { abbr: "F4 ITA" },
  "f4-british": { abbr: "F4 GBR" },
  "f4-spanish": { abbr: "F4 ESP" },
  "f4-french": { abbr: "F4 FRA" },
  "f4-uae": { abbr: "F4 UAE" },
  "f4-us": { abbr: "F4 USA" },
  "german-f4": { abbr: "F4 GER" },
};

// The ladder as tiered rows, top rung first. An item with a `planned` payload
// has no DB row yet and renders as a dashed placeholder card; if a real
// championship under the same id is ever ingested, the real card takes over
// automatically.
type LadderItem = {
  id: string;
  planned?: { abbr: string; name: string };
};

const LADDER_TIERS: { label: string; accent: string; items: LadderItem[] }[] = [
  {
    label: "Formula 2 · IndyCar",
    accent: "#2563eb",
    items: [{ id: "f2" }, { id: "indycar" }],
  },
  {
    label: "Formula 3 · Formula E · Super Formula",
    accent: "#f97316",
    items: [{ id: "f3" }, { id: "formula-e" }, { id: "super-formula" }],
  },
  {
    label: "Formula Regional",
    accent: "#1e3a8a",
    items: [
      { id: "freca" },
      { id: "frme" },
      { id: "fr-americas" },
      {
        id: "frjc",
        planned: { abbr: "FRJC", name: "Formula Regional Japanese Championship" },
      },
      { id: "fr-oceania" },
    ],
  },
  {
    label: "F4 & junior formulae",
    accent: "#fafafa",
    items: [
      { id: "indy-nxt" },
      {
        id: "ef-open",
        planned: { abbr: "EF Open", name: "Euroformula Open" },
      },
      {
        id: "sf-lights",
        planned: { abbr: "SF Lights", name: "Super Formula Lights" },
      },
      { id: "italian-f4" },
      { id: "f4-british" },
      { id: "f4-spanish" },
      { id: "f4-french" },
      { id: "f4-uae" },
      { id: "f4-us" },
    ],
  },
];

// In the database but deliberately not listed on this page — their
// /championships pages stay reachable via their URLs.
const HIDDEN_FROM_INDEX = ["macau-gp"];

const FORMER_ORDER = [
  "german-f4",
  "toyota-racing-series",
  "formula-renault-eurocup",
];

const BEYOND_ORDER = [
  "imsa",
  "nascar-cup",
  "gt-world-challenge-europe",
  "wec-hypercar",
  "wec-lmgt3",
];

function orderList(list: Championship[], order: string[]): Championship[] {
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return [...list].sort(
    (a, b) =>
      idx(a.id) - idx(b.id) ||
      (a.tier ?? 9) - (b.tier ?? 9) ||
      a.short_name.localeCompare(b.short_name),
  );
}

// The climb between tiers — two chevrons pointing up, tinted with the colour
// of the rung below (the one you climb from).
function Rung({ color }: { color: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", justifyContent: "center", padding: "6px 0", opacity: 0.4 }}
    >
      <svg width="16" height="28" viewBox="0 0 16 28" fill="none">
        <path d="M2 14 L8 5 L14 14" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 23 L8 14 L14 23" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default async function ChampionshipsIndex() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Championships</h1>
        <p>Supabase is not configured yet.</p>
      </main>
    );
  }

  const [{ data: championships, error }, { data: seasons }] = await Promise.all([
    supabase
      .from("championships")
      .select("id, name, short_name, kind, tier, color, section, ended_year"),
    supabase.from("seasons").select("championship_id, year"),
  ]);

  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Championships</h1>
        <p>Database error: {error.message}</p>
      </main>
    );
  }

  const seasonRows = (seasons ?? []) as unknown as SeasonRow[];
  const seasonsByChamp = new Map<string, number[]>();
  for (const s of seasonRows) {
    const list = seasonsByChamp.get(s.championship_id) ?? [];
    list.push(s.year);
    seasonsByChamp.set(s.championship_id, list);
  }

  const all = (championships ?? []) as unknown as Championship[];
  const byId = new Map(all.map((c) => [c.id, c]));

  // Section from the DB, with a fallback to the old kind-based grouping so a
  // freshly added championship is never invisible.
  const sect = (c: Championship) =>
    c.section ?? (c.kind === "ladder" ? "ladder" : "beyond");

  // Ids the ladder tiers claim — those championships render inside their
  // tier, so they must not repeat in the other sections.
  const ladderClaimed = new Set(
    LADDER_TIERS.flatMap((t) => t.items.map((i) => i.id)),
  );

  // Safety net (the old page's rule, adapted to the tier layout): a
  // ladder-section championship that no tier claims and that is not
  // deliberately hidden stays visible at the end of the final tier.
  const leftover = all
    .filter(
      (c) =>
        sect(c) === "ladder" &&
        !ladderClaimed.has(c.id) &&
        !HIDDEN_FROM_INDEX.includes(c.id),
    )
    .map((c) => ({ id: c.id }) as LadderItem);

  const former = orderList(
    all.filter((c) => sect(c) === "former" && !ladderClaimed.has(c.id)),
    FORMER_ORDER,
  );
  const beyond = orderList(
    all.filter((c) => sect(c) === "beyond" && !ladderClaimed.has(c.id)),
    BEYOND_ORDER,
  );

  const meta = (c: Championship, formerCard: boolean) => {
    const years = seasonsByChamp.get(c.id) ?? [];
    if (years.length > 0) {
      return `${Math.min(...years)}–${Math.max(...years)} · ${years.length} season${years.length === 1 ? "" : "s"}`;
    }
    if (formerCard && c.ended_year !== null) return `Ended ${c.ended_year}`;
    return "Standings-level coverage";
  };

  // A real, linked championship card in the accent colour of its tier.
  const champCard = (c: Championship, accent: string, formerCard: boolean) => {
    const display = DISPLAY[c.id];
    const abbr = display?.abbr ?? c.short_name;
    const name = display?.name ?? c.name;
    return (
      <Link key={c.id} href={`/championships/${c.id}`} style={CARD}>
        <div
          style={{
            height: 4,
            background: accent,
            opacity: formerCard ? 0.45 : 1,
            borderRadius: 2,
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
            {abbr}
          </span>
          <span style={CHIP}>
            {c.kind === "ladder" ? "race-by-race" : "standings-level"}
          </span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 10px" }}>{name}</div>
        <div style={{ color: "#64748b", fontSize: 12 }}>{meta(c, formerCard)}</div>
      </Link>
    );
  };

  // A dashed placeholder for a championship that is not in the database yet.
  const plannedCard = (item: LadderItem) => {
    const planned = item.planned!;
    return (
      <div key={item.id} style={PLACEHOLDER_CARD}>
        <div
          style={{
            height: 4,
            border: "1px dashed #334155",
            borderRadius: 2,
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
            {planned.abbr}
          </span>
          <span style={PLANNED_CHIP}>not yet in the DB</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 10px" }}>{planned.name}</div>
        <div style={{ color: "#64748b", fontSize: 12 }}>Not yet in the database</div>
      </div>
    );
  };

  // Renders a ladder tier item: the DB card when the championship exists,
  // the planned placeholder otherwise.
  const ladderItem = (item: LadderItem, accent: string) => {
    const c = byId.get(item.id);
    if (c) return champCard(c, accent, false);
    if (item.planned) return plannedCard(item);
    return null;
  };

  const section = (title: string, subtitle: string, list: Championship[]) => (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>{subtitle}</p>
      <div style={GRID}>
        {list.map((c) => champCard(c, "#475569", sect(c) === "former"))}
      </div>
    </section>
  );

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem" }}>
      <div style={{ padding: "2.5rem 0 1.5rem" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-0.02em" }}>Championships</h1>
        <p style={{ color: "#94a3b8", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          The ladder from F4 to F2, race-by-race. Everything beyond it — plus the former
          series that closed — is tracked at standings level: enough for a complete Super
          Licence picture.
        </p>
      </div>

      {/* The ladder: tiered rows, top rung first. */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>The ladder</h2>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
          The rungs to the grid: F4 at the bottom, Formula 2 and IndyCar at the
          summit, the Formula Regional band in between — plus the top
          internationals alongside.
        </p>
        {LADDER_TIERS.map((tier, ti) => {
          const items =
            ti === LADDER_TIERS.length - 1 ? [...tier.items, ...leftover] : tier.items;
          return (
            <div key={tier.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: tier.accent,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#64748b",
                  }}
                >
                  {tier.label}
                </span>
              </div>
              <div style={GRID}>
                {items.map((item) => ladderItem(item, tier.accent))}
              </div>
              {ti < LADDER_TIERS.length - 1 && <Rung color={tier.accent} />}
            </div>
          );
        })}
      </section>

      {former.length > 0 &&
        section(
          "Former championships",
          "The roads that closed — championships that ran their final seasons.",
          former,
        )}
      {beyond.length > 0 &&
        section(
          "Beyond the ladder",
          "GT, sportscar and oval racing — the championships outside the single-seater ladder.",
          beyond,
        )}
      {all.length === 0 && <p>No championships found yet.</p>}
    </main>
  );
}
