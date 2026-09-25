import fs from 'fs';
import path from 'path';
import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { de } from '../locales/de';

// Every literal key the code asks for — t('a.b.c') / t(language, 'a.b.c') —
// must resolve to text in all three languages. The type checker can't see
// this (t takes a string), so a key saved under the wrong section shows up on
// screen as "trainingLog.progress.changeTitle" (Session 46). Template keys
// (`blockVariations.${id}.label`) are checked where their ids are defined.

const SRC = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'locales' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  // t('x.y'), t(language, 'x.y'), translate(lang, 'x.y') — a dotted literal key.
  const re = /\b(?:t|translate)\(\s*(?:[A-Za-z_.]+\s*,\s*)?'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g;
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) keys.set(m[1], path.relative(SRC, file));
  }
  return keys;
}

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict);
}

describe('i18n — keys used in code exist', () => {
  const keys = usedKeys();

  it('finds the keys (sanity)', () => {
    expect(keys.size).toBeGreaterThan(200);
  });

  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('every key resolves to text in %s', (_lang, dict) => {
    const missing = [...keys].filter(([key]) => typeof resolve(dict, key) !== 'string').map(([key, file]) => `${key}  (${file})`);
    expect(missing).toEqual([]);
  });
});
