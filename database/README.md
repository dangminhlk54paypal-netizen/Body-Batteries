# database/ — USDA FoodData Central offline pipeline

This folder is the offline, build-time source for a **separate, additional**
ingredient lookup list (English names, US Foundation Foods) — it does **not**
replace `food_items.csv` (the Vietnamese-dish source of truth used by the app).
See the full spec: `.ai/parallel-reports/S-N-food-data-usda-spec.md`.

## Folders

- `raw/` — heavy USDA bulk JSON files. **Not committed** (gitignored — see
  `.gitignore`: `database/raw/*.json`). Git should never carry multi-MB bulk
  downloads.
- `extract/` — compact, generated CSV. **Committed** — small (~150 KB for 363
  foods x 13 nutrients).

## How to update to a newer USDA release

1. Download a newer "Foundation Foods" JSON bulk file from
   `https://fdc.nal.usda.gov/download-datasets` and drop it into `database/raw/`
   (keep the original filename — the script picks the file with the latest
   `YYYY-MM-DD` date embedded in its name, so old and new files can coexist).
2. Run `npm run gen:usda`. This regenerates:
   - `database/extract/usda_foundation_foods.csv`
   - `src/data/food/usdaFoods.generated.ts` (the app-bundled copy)
3. Run `npx tsc --noEmit` and `npx jest` to confirm nothing broke.

The raw JSON file is never read by the app or by an AI assistant directly —
only `scripts/generate-usda-db.js` (via Node) touches it, to avoid burning
tokens on a multi-MB file.

## Translating names to Vietnamese (`usda_names_vi.csv`)

USDA rows have no Vietnamese name by default — `name_vi` is left blank for
all 363 foods. Rather than translating everything up front, `database/usda_names_vi.csv`
(columns: `id,name_vi`) is a small **cover file** you add rows to on demand,
only for foods actually used in the app.

To translate one more food: add a line to `usda_names_vi.csv` (e.g.
`usda_321358,Hummus (đậu gà nghiền)`), then run `npm run gen:usda`. The
script left-joins this file onto the generated CSV/TS output by `id` — any
id present gets its `name_vi` filled in, everything else stays blank.
Translations live in the cover file, not the generated output, so
re-running the generator (e.g. after a newer USDA release) never loses them.
