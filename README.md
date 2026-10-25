# Road to F1

The junior single-seater racing database — results, career ladders, driver academies and rankings on the road to Formula 1.

Think procyclingstats, but for the F1 ladder: F2, F3, FRECA and F4, plus every championship that awards FIA Super Licence points.

## Features (planned)

- Series pages: standings, race weekends and results for F2, F3, FRECA and F4
- Driver profiles: career ladder, academy tags, headshots, head-to-head comparison
- FIA Super Licence points tracker — full allocation table, rolling 3-year window, 40-point threshold
- Talent rankings (a "Ladder Index", inspired by f1metrics)

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Supabase](https://supabase.com) (PostgreSQL) — schema in `supabase/schema.sql`
- [Vercel](https://vercel.com) — free-tier hosting

## Getting started

1. Create a free project at [supabase.com](https://supabase.com), open **SQL Editor**, paste the whole of `supabase/schema.sql` and run it. This creates all tables, views and seed data.
2. Copy `.env.example` to `.env.local` and fill in your project URL, anon key and service role key (Supabase → Settings → API).
3. Install and run:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000 — the homepage lists the championships from the database.

## Deploying

Import this repo in [Vercel](https://vercel.com), add the same environment variables, deploy. The free tier is fine to start (~$0, plus ~$12/yr if you add a domain later).

## Repository layout

```text
road-to-f1/
├── app/            Next.js pages (App Router)
├── lib/            shared helpers (Supabase clients)
├── supabase/       database schema
├── docs/           data pipeline & other documentation
├── .env.example    environment variable template
├── package.json
├── tsconfig.json
└── next.config.ts
```

See `docs/data-pipeline.md` for how results data gets into the database.

## Roadmap

1. Schema + scaffold + seed (this repo)
2. Ingest first real dataset: FRECA (structured HTML — easiest win)
3. F2/F3 PDF extraction pipeline with review queue
4. Core pages: series standings, driver profiles, career ladder
5. Super Licence tracker + Ladder Index rankings
6. Design pass
7. Launch on free tier; add domain
