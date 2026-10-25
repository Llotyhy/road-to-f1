-- ══════════════════════════════════════════════════════════════════
-- ROAD TO F1 — Database schema (PostgreSQL / Supabase)
-- Run this file in the Supabase SQL editor (Dashboard → SQL → New query).
-- Sections: 1 core  2 people  3 results  4 super licence
--           5 ingestion pipeline  6 views  7 seed data
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CHAMPIONSHIPS & SEASONS
-- ─────────────────────────────────────────────

create table championships (
  id          text primary key,          -- slug: 'f2', 'f3', 'freca', 'italian-f4', 'indycar'
  name        text not null,
  short_name  text not null,
  kind        text not null check (kind in ('ladder', 'regional', 'external')),
  tier        int check (tier between 1 and 5),  -- 1 = highest (F2); ladder depth reference
  color       text,                      -- hex accent used by the frontend
  notes       text,
  created_at  timestamptz not null default now()
);

create table seasons (
  id               uuid primary key default gen_random_uuid(),
  championship_id  text not null references championships(id) on delete cascade,
  year             int not null,
  starts_on        date,
  ends_on          date,
  created_at       timestamptz not null default now(),
  unique (championship_id, year)
);

-- ─────────────────────────────────────────────
-- 2. DRIVERS, TEAMS, ACADEMIES
-- ─────────────────────────────────────────────

create table drivers (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,   -- 'gabriel-bortoleto'
  full_name      text not null,
  date_of_birth  date,
  nationality    char(2),                -- ISO 3166-1 alpha-2
  headshot_url   text,
  notes          text,
  created_at     timestamptz not null default now()
);

-- Spelling variants used to match driver names in ingested documents
create table driver_aliases (
  driver_id  uuid not null references drivers(id) on delete cascade,
  alias      text not null,
  primary key (driver_id, alias)
);

create table teams (
  id          text primary key,          -- slug: 'invicta-racing'
  name        text not null,
  full_name   text,
  country     char(2),
  color       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- F1 junior programmes (Red Bull Junior Team, Ferrari Driver Academy, ...)
create table academies (
  id          text primary key,          -- 'red-bull', 'ferrari'
  name        text not null,
  f1_team     text,
  color       text,
  established int,
  notes       text
);

create table academy_memberships (
  driver_id  uuid not null references drivers(id) on delete cascade,
  academy_id text not null references academies(id) on delete cascade,
  joined_on  date,
  left_on    date,                       -- null = currently a member
  note       text,
  primary key (driver_id, academy_id)
);

-- A driver's entry into a championship season
create table season_entries (
  driver_id       uuid not null references drivers(id) on delete cascade,
  season_id       uuid not null references seasons(id) on delete cascade,
  team_id         text references teams(id),
  car_number      int,
  rookie          boolean not null default false,
  final_position  int,                   -- filled at season end (also derivable from results)
  primary key (driver_id, season_id)
);

-- ─────────────────────────────────────────────
-- 3. RACE WEEKENDS, SESSIONS & RESULTS
-- ─────────────────────────────────────────────

create table race_weekends (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons(id) on delete cascade,
  round      int not null,
  name       text not null,              -- 'Yas Marina'
  circuit    text,
  country    char(2),
  date_from  date,
  date_to    date,
  unique (season_id, round)
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  weekend_id    uuid not null references race_weekends(id) on delete cascade,
  name          text not null,           -- 'Feature Race', 'Sprint Race', 'Race 2'
  session_type  text not null check (session_type in
                 ('practice', 'qualifying', 'sprint', 'feature', 'race', 'other')),
  laps          int,
  scheduled_on  date,
  unique (weekend_id, name)
);

create table results (
  session_id       uuid not null references sessions(id) on delete cascade,
  driver_id        uuid not null references drivers(id) on delete cascade,
  team_id          text references teams(id),      -- team at time of session
  grid_position    int,
  finish_position  int,                          -- null = did not finish / did not start
  status           text not null default 'finished' check (status in
                    ('finished', 'dnf', 'dns', 'dsq', 'nc', 'exc')),
  points           numeric(6,2) not null default 0,
  fastest_lap      boolean not null default false,
  note             text,
  primary key (session_id, driver_id)
);

create index results_driver_idx on results (driver_id);
create index sessions_weekend_idx on sessions (weekend_id);

-- ─────────────────────────────────────────────
-- 4. FIA SUPER LICENCE
-- ─────────────────────────────────────────────
-- The FULL allocation table lives here — every FIA-recognised championship,
-- not just the ladder series. Allocations change over time, so every version
-- is kept with a validity range.

create table sl_points_allocation (
  id               serial primary key,
  championship_id  text not null references championships(id) on delete cascade,
  position         int not null check (position between 1 and 10),
  points           numeric(5,1) not null,
  valid_from_year  int not null,
  valid_to_year    int,                  -- null = current allocation
  unique (championship_id, position, valid_from_year)
);

-- Final standings of championships we ingest at STANDINGS LEVEL ONLY
-- (IndyCar, Formula E, WEC, Super Formula, ...). One row per driver per year —
-- enough for a complete Super Licence picture without race-by-race coverage.
create table external_standings (
  driver_id        uuid not null references drivers(id) on delete cascade,
  championship_id  text not null references championships(id) on delete cascade,
  year             int not null,
  final_position   int not null,
  source           text,
  primary key (driver_id, championship_id, year)
);

-- Discretionary SL points (FIA ISC Appendix L): clean-championship bonus (+2),
-- F1 free practice (1 per session, max 10), Macau Grand Prix bonuses.
create table sl_bonus_points (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references drivers(id) on delete cascade,
  year       int not null,
  category   text not null check (category in
              ('clean_championship', 'f1_free_practice', 'macau_f3', 'macau_fr', 'macau_f4', 'other')),
  points     numeric(4,1) not null,
  source     text,
  unique (driver_id, year, category)
);

-- ─────────────────────────────────────────────
-- 5. INGESTION PIPELINE (PDF / HTML → AI extraction → review → results)
-- ─────────────────────────────────────────────

create table source_documents (
  id               uuid primary key default gen_random_uuid(),
  championship_id  text references championships(id),
  season_id        uuid references seasons(id),
  session_id       uuid references sessions(id),
  source_type      text not null check (source_type in
                    ('fia_pdf', 'vii_results_html', 'manual', 'other')),
  url              text unique,
  title            text,
  published_on     date,
  checksum         text,                 -- dedupe re-published documents
  fetched_at       timestamptz not null default now()
);

create table extraction_runs (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references source_documents(id) on delete cascade,
  status            text not null default 'pending' check (status in
                      ('pending', 'extracted', 'validated', 'needs_review', 'failed', 'imported')),
  model             text,                -- which AI model/pipeline version
  prompt_version    text,
  raw_output        jsonb,
  validation_report jsonb,
  error             text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- One row per classified driver line, awaiting merge into results.
create table extracted_results (
  run_id              uuid not null references extraction_runs(id) on delete cascade,
  line_no             int not null,
  position            int,
  driver_name         text not null,     -- exactly as written in the source
  matched_driver_id   uuid references drivers(id),
  team_name           text,
  matched_team_id     text references teams(id),
  points              numeric(6,2),
  status_text         text,              -- 'DNF', '+25.3s', ...
  confidence          numeric(3,2),     -- matcher confidence 0–1
  review_note         text,
  primary key (run_id, line_no)
);

-- ─────────────────────────────────────────────
-- 6. VIEWS
-- ─────────────────────────────────────────────

-- Championship standings computed live from race results
create or replace view v_championship_standings as
select
  se.id                    as season_id,
  c.id                     as championship_id,
  c.short_name,
  se.year,
  r.driver_id,
  sum(r.points)                                        as points,
  count(*) filter (where r.finish_position = 1)        as wins,
  count(*) filter (where r.finish_position between 1 and 3) as podiums,
  count(*) filter (where r.fastest_lap)                as fastest_laps,
  min(r.grid_position)                                 as best_grid
from results r
join sessions ss   on ss.id = r.session_id
join race_weekends w on w.id = ss.weekend_id
join seasons se    on se.id = w.season_id
join championships c on c.id = se.championship_id
group by se.id, c.id, c.short_name, se.year, r.driver_id;

-- A driver's full career ladder (the site's signature feature)
create or replace view v_driver_career as
select
  d.id as driver_id, d.slug, d.full_name,
  se.year, c.id as championship_id, c.short_name, c.tier,
  ent.team_id, ent.car_number, ent.rookie, ent.final_position
from drivers d
join season_entries ent on ent.driver_id = d.id
join seasons se         on se.id = ent.season_id
join championships c    on c.id = se.championship_id
order by d.slug, se.year;

-- Super Licence points per driver per calendar year.
-- FIA rule: at most two championships count per year (the second must start
-- after the first ends); approximated here by taking the two best results.
create or replace view v_superlicence_yearly as
with per_championship as (
  select ent.driver_id, se.year, c.id as championship_id, ent.final_position as position
  from season_entries ent
  join seasons se      on se.id = ent.season_id
  join championships c on c.id = se.championship_id
  where ent.final_position is not null
  union all
  select es.driver_id, es.year, es.championship_id, es.final_position
  from external_standings es
),
scored as (
  select pc.driver_id, pc.year, a.points
  from per_championship pc
  join sl_points_allocation a
    on a.championship_id = pc.championship_id
   and a.position = pc.position
   and pc.year between a.valid_from_year and coalesce(a.valid_to_year, 9999)
),
ranked as (
  select *, row_number() over (partition by driver_id, year order by points desc) as rn
  from scored
)
select driver_id, year, sum(points) as sl_points
from ranked
where rn <= 2
group by driver_id, year;

-- Rolling 3-year Super Licence totals (the F1 threshold is 40 points).
-- The FIA also allows a 2-prior-years + current-year window; compute both in
-- the application layer and take the better total, as the regulation does.
create or replace view v_superlicence_totals as
select
  y.driver_id,
  y.year as through_year,
  sum(w.sl_points) as sl_points_3y
from (select distinct driver_id, year from v_superlicence_yearly) y
join v_superlicence_yearly w
  on w.driver_id = y.driver_id
 and w.year between y.year - 2 and y.year
group by y.driver_id, y.year;

-- ─────────────────────────────────────────────
-- 7. SEED DATA
-- ─────────────────────────────────────────────

insert into championships (id, name, short_name, kind, tier, color) values
  ('f2',         'FIA Formula 2 Championship',                          'F2',     'ladder',   1, '#3b82f6'),
  ('f3',         'FIA Formula 3 Championship',                          'F3',     'ladder',   2, '#ef4444'),
  ('freca',      'Formula Regional European Championship by Alpine',    'FRECA',  'ladder',   3, '#f97316'),
  ('italian-f4', 'Italian Formula 4 Championship',                      'ITA F4', 'ladder',   4, '#14b8a6'),
  -- external championships: standings-level ingestion only, for Super Licence
  ('indycar',    'IndyCar Series',                                      'IndyCar','external', 1, '#d10600'),
  ('formula-e',  'FIA Formula E World Championship',                    'FE',     'external', 1, '#00c2b3'),
  ('super-formula','Super Formula Championship',                        'SF',     'external', 2, '#e00b0b'),
  ('wec-hypercar','FIA World Endurance Championship — Hypercar',        'WEC',    'external', 1, '#7c3aed');

insert into academies (id, name, f1_team, color) values
  ('red-bull',     'Red Bull Junior Team',                    'Oracle Red Bull Racing', '#302483'),
  ('ferrari',      'Ferrari Driver Academy',                  'Scuderia Ferrari',       '#e00b0b'),
  ('mercedes',     'Mercedes Junior Programme',               'Mercedes-AMG Petronas',  '#00d2be'),
  ('mclaren',      'McLaren Driver Development Programme',    'McLaren Racing',         '#ff8000'),
  ('alpine',       'Alpine Academy',                          'Alpine F1 Team',         '#0093cc'),
  ('williams',     'Williams Driver Academy',                 'Williams Racing',        '#0093ff'),
  ('aston-martin', 'Aston Martin Racing Driver Academy',      'Aston Martin Aramco',    '#229971');

-- Current FIA Super Licence allocation (verify against the latest FIA ISC
-- Supplement 1 each season before relying on it).
insert into sl_points_allocation (championship_id, position, points, valid_from_year)
select 'f2', p.rn, p.pts, 2025 from unnest(array[40,40,40,30,20,10,8,6,4,3]) with ordinality as p(pts, rn);
insert into sl_points_allocation (championship_id, position, points, valid_from_year)
select 'f3', p.rn, p.pts, 2025 from unnest(array[30,25,20,15,12,9,7,5,3,2]) with ordinality as p(pts, rn);
insert into sl_points_allocation (championship_id, position, points, valid_from_year)
select 'freca', p.rn, p.pts, 2025 from unnest(array[25,20,15,10,7,5,3,2,1,0]) with ordinality as p(pts, rn);
-- TODO: verify F4 values in the current FIA table before inserting.
-- insert into sl_points_allocation (championship_id, position, points, valid_from_year)
-- select 'italian-f4', p.rn, p.pts, 2025 from unnest(array[12,10,7,5,3,2,1,1,0,0]) with ordinality as p(pts, rn);

-- One season so the app has something to render after the first deploy.
insert into seasons (championship_id, year, starts_on, ends_on)
values ('f2', 2024, '2024-03-01', '2024-12-08');
