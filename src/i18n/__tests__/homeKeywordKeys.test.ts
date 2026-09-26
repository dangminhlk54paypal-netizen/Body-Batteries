import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { de } from '../locales/de';
import type { KeywordBattery } from '../../domain/battery/homeKeywords';

// HomeKeywordChips builds `screens.home.keywords.${battery}Short|Done` at run
// time, which usedKeys.test.ts can't see — so check every combination here.
const BATTERIES: KeywordBattery[] = ['protein', 'water', 'sleep', 'movement'];

describe('home keyword chip texts', () => {
  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('exist in %s, and "short" texts show the amount', (_lang, dict) => {
    const k = dict.screens.home.keywords as Record<string, string>;
    for (const b of BATTERIES) {
      expect(typeof k[`${b}Done`]).toBe('string');
      expect(k[`${b}Short`]).toContain('{{amount}}');
    }
  });
});
