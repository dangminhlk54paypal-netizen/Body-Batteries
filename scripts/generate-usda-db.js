#!/usr/bin/env node
/*
 * Converts a USDA FoodData Central "Foundation Foods" bulk JSON file
 * (database/raw/FoodData_Central_*.json — heavy, gitignored) into a compact
 * CSV lookup table (database/extract/usda_foundation_foods.csv) and embeds it
 * into a TypeScript module (src/data/food/usdaFoods.generated.ts), mirroring
 * scripts/generate-food-db.js.
 *
 * This is a SEPARATE, ADDITIONAL lookup list of US ingredients — it never
 * touches food_items.csv (the Vietnamese-dish source of truth).
 *
 * Vietnamese names are translated on demand via a build-time "cover" file,
 * database/usda_names_vi.csv (id,name_vi). This script left-joins it onto
 * every generated row: an id present there gets its name_vi filled in,
 * everything else stays blank. Re-running never loses a translation because
 * translations live in the cover file, not in the generated output.
 *
 * German names (search-only — the user shops in German supermarkets) work
 * the same way via database/usda_names_de.csv (id,name_de), left-joined
 * into a `name_de` column appended to the output header.
 *
 * Run by hand: `npm run gen:usda`. Not chained into `npm start` (USDA data
 * rarely changes; see database/README.md to add a newer bulk file).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rawDir = path.join(root, 'database', 'raw');
const extractDir = path.join(root, 'database', 'extract');
const csvOutPath = path.join(extractDir, 'usda_foundation_foods.csv');
const tsOutPath = path.join(root, 'src', 'data', 'food', 'usdaFoods.generated.ts');
const namesViPath = path.join(root, 'database', 'usda_names_vi.csv');
const namesDePath = path.join(root, 'database', 'usda_names_de.csv');

// app CSV column -> USDA nutrient.number candidates, first match wins (all
// values are already per 100 g; minerals are already in mg — no unit scaling
// needed). See .ai/parallel-reports/S-N-food-data-usda-spec.md section 4.
//
// The 2026 Foundation Foods release reports several nutrients under NEW
// analysis-method numbers alongside (or instead of) the classic ones:
//   carb:  205 "by difference"        | 205.2 "by summation"
//   fiber: 291 "total dietary"        | 293   "AOAC 2011.25"
//   sugar: 269 "Total Sugars" (5 rows only!) | 269.3 "Sugars, Total" (136 rows)
// Mapping only the classic number silently zeroed sugar/fiber/carb for those
// rows, so eating them never charged the sugar/fiber micro batteries.
const NUTRIENT_MAP = {
  water_g: ['255'],
  protein_g: ['203'],
  fat_g: ['204'],
  carb_g: ['205', '205.2'],
  fiber_g: ['291', '293'],
  sugar_g: ['269', '269.3'],
  calcium_mg: ['301'],
  iron_mg: ['303'],
  sodium_mg: ['307'],
  potassium_mg: ['306'],
  magnesium_mg: ['304'],
  zinc_mg: ['309'],
};
const ENERGY_NUTRIENT_NUMBER = '208';

// USDA foodCategory.description -> app category enum (src/types/food.ts uses
// a free-form string, but we reuse the same values as food_items.csv where the
// mapping is clean). Unmapped categories keep their original English string
// rather than being forced into a wrong bucket (see spec section 6).
const CATEGORY_MAP = {
  'Beef Products': 'meat',
  'Cereal Grains and Pasta': 'grain',
  'Dairy and Egg Products': 'egg_dairy',
  'Fats and Oils': 'fat_sugar',
  'Finfish and Shellfish Products': 'fish',
  'Fruits and Fruit Juices': 'fruit',
  'Lamb, Veal, and Game Products': 'meat',
  'Legumes and Legume Products': 'legume_nut',
  'Nut and Seed Products': 'legume_nut',
  'Pork Products': 'meat',
  'Poultry Products': 'meat',
  'Sausages and Luncheon Meats': 'meat',
  Sweets: 'fat_sugar',
  'Vegetables and Vegetable Products': 'vegetable',
};

function findLatestRawFile() {
  if (!fs.existsSync(rawDir)) {
    throw new Error(`Missing ${path.relative(root, rawDir)} — put the USDA bulk JSON there (see database/README.md).`);
  }
  const candidates = fs
    .readdirSync(rawDir)
    .filter((f) => /^FoodData_Central_.*food.*json.*\.json$/i.test(f));
  if (candidates.length === 0) {
    throw new Error(`No FoodData_Central_*food*json*.json file found in ${path.relative(root, rawDir)}.`);
  }
  // Pick the newest by the YYYY-MM-DD date embedded in the filename, so
  // dropping a newer bulk file in without deleting the old one just works.
  candidates.sort((a, b) => {
    const dateA = (a.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const dateB = (b.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    return dateB.localeCompare(dateA);
  });
  return path.join(rawDir, candidates[0]);
}

// Escape one CSV field: wrap in quotes (doubling internal quotes) whenever it
// contains a comma, quote, or newline — matches splitCsvLine() in foodCsv.ts.
function csvField(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Parse one CSV line, honoring double-quoted fields (mirrors splitCsvLine in
// src/data/food/foodCsv.ts — duplicated here since this script is plain
// CommonJS and does not import TS modules).
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// Load database/usda_names_vi.csv (id,name_vi) into a lookup map. Missing
// file (translation not started yet) is not an error — just an empty map.
function loadNamesVi() {
  if (!fs.existsSync(namesViPath)) return {};
  const lines = fs
    .readFileSync(namesViPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const [id, nameVi] = splitCsvLine(lines[i]);
    if (id && id.trim()) map[id.trim()] = (nameVi || '').trim();
  }
  return map;
}

// Load database/usda_names_de.csv (id,name_de) the same way as
// loadNamesVi() above — a separate cover file for German (search-only)
// names. Missing file is not an error — just an empty map.
function loadNamesDe() {
  if (!fs.existsSync(namesDePath)) return {};
  const lines = fs
    .readFileSync(namesDePath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const [id, nameDe] = splitCsvLine(lines[i]);
    if (id && id.trim()) map[id.trim()] = (nameDe || '').trim();
  }
  return map;
}

function nutrientMapFor(food) {
  const byNumber = {};
  for (const n of food.foodNutrients) {
    if (n && n.nutrient && n.nutrient.number != null && n.amount != null) {
      byNumber[n.nutrient.number] = n.amount;
    }
  }
  return byNumber;
}

function buildRow(food, namesVi, namesDe) {
  const byNumber = nutrientMapFor(food);

  const values = {};
  for (const [column, numbers] of Object.entries(NUTRIENT_MAP)) {
    const found = numbers.map((num) => byNumber[num]).find((v) => v != null);
    // "Carbohydrate, by difference" can come out slightly negative for pure
    // meats/fats — clamp so the app never shows a negative macro.
    values[column] = Math.max(0, found ?? 0);
  }

  // Unit convention (mirrors parseFoodCsv in src/data/food/foodCsv.ts):
  // carb_g is TOTAL carbohydrate and CONTAINS sugar_g + fiber_g, so it can
  // never be below their sum. USDA "by difference" carb sometimes is (42
  // rows in the 2026 release, e.g. dry beans with fiber 4.3 but carb 0) —
  // without this the Carbs battery under-charges when those foods are eaten.
  values.carb_g = Math.max(
    values.carb_g,
    Math.round((values.sugar_g + values.fiber_g) * 1000) / 1000
  );

  let energyKcal = byNumber[ENERGY_NUTRIENT_NUMBER];
  let note = '';
  let kcalComputed = false;
  if (energyKcal == null) {
    // Atwater fallback — see spec section 5. Rounded, flagged in `note` so
    // it's clear this is an estimate, not a measured USDA value.
    energyKcal = Math.round(values.protein_g * 4 + values.carb_g * 4 + values.fat_g * 9);
    note = 'kcal computed (Atwater)';
    kcalComputed = true;
  } else {
    energyKcal = Math.round(energyKcal);
  }

  const categoryDescription = food.foodCategory && food.foodCategory.description;
  const category = CATEGORY_MAP[categoryDescription] || categoryDescription || '';

  const id = `usda_${food.fdcId}`;
  const row = [
    id,
    namesVi[id] || '', // name_vi — filled via left-join with database/usda_names_vi.csv, else blank
    food.description || '',
    category,
    100, // default_serving_g
    '', // serving_presets — USDA portions are US-cup/tbsp based, not used
    energyKcal,
    values.water_g,
    values.protein_g,
    values.fat_g,
    values.carb_g,
    values.fiber_g,
    values.sugar_g,
    values.calcium_mg,
    values.iron_mg,
    values.sodium_mg,
    values.potassium_mg,
    values.magnesium_mg,
    values.zinc_mg,
    'USDA-FDC',
    note,
    namesDe[id] || '', // name_de — filled via left-join with database/usda_names_de.csv, else blank
  ];

  return { line: row.map(csvField).join(','), kcalComputed };
}

function main() {
  const rawPath = findLatestRawFile();
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const foods = (raw.FoundationFoods || []).filter(Boolean);
  const namesVi = loadNamesVi();
  const namesDe = loadNamesDe();

  const header =
    'id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note,name_de';
  const lines = [header];
  let kcalComputedCount = 0;
  let translatedCount = 0;
  let translatedDeCount = 0;

  for (const food of foods) {
    const { line, kcalComputed } = buildRow(food, namesVi, namesDe);
    lines.push(line);
    if (kcalComputed) kcalComputedCount++;
    if (namesVi[`usda_${food.fdcId}`]) translatedCount++;
    if (namesDe[`usda_${food.fdcId}`]) translatedDeCount++;
  }

  const csv = lines.join('\n') + '\n';

  fs.mkdirSync(extractDir, { recursive: true });
  fs.writeFileSync(csvOutPath, csv, 'utf8');

  const escaped = csv
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const out = `// AUTO-GENERATED from ${path.relative(root, rawPath)} — DO NOT EDIT BY HAND.
// Run \`npm run gen:usda\` to regenerate (see database/README.md).
export const USDA_FOOD_CSV_RAW = \`${escaped}\`;
`;
  fs.mkdirSync(path.dirname(tsOutPath), { recursive: true });
  fs.writeFileSync(tsOutPath, out, 'utf8');

  console.log(
    `gen:usda → ${path.relative(root, csvOutPath)} + ${path.relative(root, tsOutPath)} (${foods.length} food rows, ${kcalComputedCount} kcal computed, ${translatedCount} name_vi translated, ${translatedDeCount} name_de translated)`
  );
}

main();
