#!/usr/bin/env node
/*
 * Embeds `food_items.csv` into a TypeScript module as a raw string so the app
 * can bundle it on every platform (native / web / jest) without any runtime
 * file-system or asset loading. The CSV stays the single editable source of
 * truth — edit `food_items.csv`, then run `npm run gen:food` (also runs
 * automatically before `npm start`).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const csvPath = path.join(root, 'food_items.csv');
const outPath = path.join(root, 'src', 'data', 'food', 'foodDatabase.generated.ts');

const csv = fs.readFileSync(csvPath, 'utf8');

// Escape so the content is safe inside a TS template literal.
const escaped = csv
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out = `// AUTO-GENERATED from food_items.csv — DO NOT EDIT BY HAND.
// Edit food_items.csv, then run \`npm run gen:food\` to regenerate.
export const FOOD_CSV_RAW = \`${escaped}\`;
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');

const rows = csv.split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1;
console.log(`gen:food → ${path.relative(root, outPath)} (${rows} food rows)`);
