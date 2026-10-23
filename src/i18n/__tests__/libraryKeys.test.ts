import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { LIBRARY_EXTRA_FIELDS, LIBRARY_MAIN_FIELDS } from '../../domain/food/library/libraryMapping';
import type { LibraryRowIssue } from '../../domain/food/library/libraryMapping';

// LibrarySourcesPanel builds `myFoods.library.fields.${field}` and
// `myFoods.library.issues.${issue}` at run time, which usedKeys.test.ts can't
// see — so check every field and every row issue here.
const ISSUES: LibraryRowIssue[] = ['missingName', 'missingEnergy', 'negative', 'missingServing'];

describe('"Nguồn của tôi" field and issue texts', () => {
  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('exist in %s', (_lang, dict) => {
    const lib = dict.myFoods.library as unknown as { fields: Record<string, string>; issues: Record<string, string> };
    for (const f of [...LIBRARY_MAIN_FIELDS, ...LIBRARY_EXTRA_FIELDS]) expect(typeof lib.fields[f]).toBe('string');
    for (const i of ISSUES) expect(typeof lib.issues[i]).toBe('string');
  });
});
