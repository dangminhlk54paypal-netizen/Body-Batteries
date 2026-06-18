import type { FoodItem, Nutrition, ServingPreset } from '../../types/food';

// Pure parser for the `food_items.csv` format. Kept dependency-free and
// side-effect-free so it can run identically in the app, on web, and in jest.
//
// Header (per-100 g nutrition):
//   id, name_vi, name_en, category, default_serving_g, serving_presets,
//   energy_kcal, water_g, protein_g, fat_g, carb_g, fiber_g, sugar_g,
//   calcium_mg, iron_mg, sodium_mg, potassium_mg, magnesium_mg, zinc_mg,
//   source, note

// Split one CSV line into fields, honoring double-quoted fields that may
// contain commas (e.g. "White rice, cooked"). Doubled quotes ("") inside a
// quoted field are treated as a literal quote.
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip the escaped quote
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

// Parse an empty-tolerant numeric cell. Blank → 0.
function num(value: string | undefined): number {
  const n = parseFloat((value ?? '').trim());
  return Number.isNaN(n) ? 0 : n;
}

// Parse "chén=150|bát=250" → [{ label: 'chén', grams: 150 }, …]. Skips malformed
// segments. Empty input → no presets.
export function parseServingPresets(value: string | undefined): ServingPreset[] {
  if (!value) return [];
  return value
    .split('|')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const eq = seg.lastIndexOf('=');
      if (eq === -1) return null;
      const label = seg.slice(0, eq).trim();
      const grams = num(seg.slice(eq + 1));
      return label && grams > 0 ? { label, grams } : null;
    })
    .filter((p): p is ServingPreset => p !== null);
}

// Map a parsed header → column index, so column order changes in the CSV don't
// break parsing (we look up by name, not position).
function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((name, i) => {
    idx[name.trim()] = i;
  });
  return idx;
}

export function parseFoodCsv(raw: string): FoodItem[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const idx = headerIndex(splitCsvLine(lines[0]));
  const at = (cells: string[], key: string): string => cells[idx[key]] ?? '';

  const items: FoodItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    const id = at(c, 'id').trim();
    if (!id) continue; // skip blank / malformed rows

    const per100g: Nutrition = {
      energyKcal: num(at(c, 'energy_kcal')),
      waterG: num(at(c, 'water_g')),
      proteinG: num(at(c, 'protein_g')),
      fatG: num(at(c, 'fat_g')),
      carbG: num(at(c, 'carb_g')),
      fiberG: num(at(c, 'fiber_g')),
      sugarG: num(at(c, 'sugar_g')),
      calciumMg: num(at(c, 'calcium_mg')),
      ironMg: num(at(c, 'iron_mg')),
      sodiumMg: num(at(c, 'sodium_mg')),
      potassiumMg: num(at(c, 'potassium_mg')),
      magnesiumMg: num(at(c, 'magnesium_mg')),
      zincMg: num(at(c, 'zinc_mg')),
    };

    items.push({
      id,
      nameVi: at(c, 'name_vi').trim(),
      nameEn: at(c, 'name_en').trim(),
      category: at(c, 'category').trim(),
      defaultServingG: num(at(c, 'default_serving_g')) || 100,
      servingPresets: parseServingPresets(at(c, 'serving_presets')),
      per100g,
      source: at(c, 'source').trim(),
      note: at(c, 'note').trim(),
    });
  }
  return items;
}
