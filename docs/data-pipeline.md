# Data Pipeline

How racing results get from official documents into the database.

## Sources

| Series | Source | Format |
| ------ | ------ | ------ |
| F2 / F3 | https://www.fia.com/documents/ | PDF classifications |
| FRECA | https://fia-frec.vii-results.com/results | Structured HTML |
| Non-ladder championships (IndyCar, Formula E, WEC, Super Formula, ...) | Final standings only | Small tables, manual/scripted |

## Pipeline

1. **Fetch** the document (FIA PDF or results HTML) and store it in `source_documents` with a checksum, so re-published documents are deduplicated.
2. **Extract**: read the PDF text layer (OCR fallback for scanned PDFs), or parse the structured HTML directly for FRECA.
3. **AI extraction**: an LLM converts the raw text into a strict JSON schema (position, driver name, team, points, status). Each run is logged in `extraction_runs` with model and prompt version.
4. **Validation**:
   - positions must be continuous 1..N
   - points must sum to the expected session total
   - driver names are matched against `drivers` / `driver_aliases` with a confidence score
5. **Review**: anything below the confidence threshold or failing a rule goes to the human review queue (`extraction_runs.status = 'needs_review'`, rows in `extracted_results`).
6. **Merge**: approved rows land in `results`. Championship standings are always computed live via the `v_championship_standings` view — never stored twice.

## Super Licence tracker

Driven by three tables:

- `sl_points_allocation` — the FULL FIA allocation table (every recognised championship), versioned by validity year
- `external_standings` — standings-level ingestion for championships we do not cover race-by-race
- `sl_bonus_points` — clean-championship bonus (+2), F1 free practice sessions, Macau Grand Prix bonuses

The views apply the FIA rules: at most two championships count per calendar year, and the licence threshold is 40 points over a rolling 3-year window (the application layer also checks the alternative 2-prior-years window and takes the better total, as the regulation does).

> Verify the allocation table against the latest FIA ISC Supplement 1 before each season.
