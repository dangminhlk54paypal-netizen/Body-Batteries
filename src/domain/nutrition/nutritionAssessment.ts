import type { MicronutrientId, MicroBatteryState } from '../../types/nutrition';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Pure, self-tracking "assessment" layer on top of the micronutrient-battery
// engine (see microBatteryEngine.ts). This produces gentle, language-aware
// suggestion text — NEVER a diagnosis or medical claim (see
// docs/01-vision-and-features.md §health, and AGENTS.md health boundary).
// The advice sentences themselves live in src/i18n/locales/{vi,en,de}.ts
// under `nutrients.<id>.underAdvice`/`overAdvice`, keyed by the same
// MicronutrientId used below — this file only holds the (language-neutral)
// thresholds that decide WHEN to show them.
//
// Every screen/sheet that shows this text must also show the disclaimer:
// t('assessment.disclaimer') (added by the caller, not repeated per-line
// here).
//
// Wording rule (see the vi.ts source strings): "a bit low on {nutrient} —
// try {example}" is OK; "deficient" / "disease risk" is NOT OK. Same for
// limits: "above the suggested cap — try cutting {example}" is OK; alarming
// words are not. Keep translations in the other two languages to the same
// gentle register.

export interface NutrientAssessmentRule {
  id: MicronutrientId;
  // Fraction of target below which a 'goal' nutrient gets a gentle
  // "add more" suggestion (e.g. 0.7 = under 70% of the daily target).
  underThreshold?: number;
  // Fraction of target above which either kind gets a neutral "over" note
  // ('goal': past the recommendation, still framed as harmless from food;
  // 'limit': past the suggested cap, framed as a gentle nudge to cut back).
  overThreshold?: number;
  // Reputable source backing the threshold/advice above (NIH ODS fact sheet,
  // WHO guideline, or USDA/HHS Dietary Guidelines for Americans — DRI-based).
  // Also copied into the Excel "reference thresholds" sheet.
  sourceUrl: string;
}

// --- Rule table --------------------------------------------------------
// vòng 2 note (per S-Q/S-R task brief): every URL below was looked up via
// WebSearch against NIH ODS / WHO / USDA sources on 2026-07-07. The dev
// should still click through and re-confirm before shipping (vòng 2).
export const ASSESSMENT_RULES: Record<MicronutrientId, NutrientAssessmentRule> = {
  fiber: {
    id: 'fiber',
    underThreshold: 0.7,
    overThreshold: 1.0,
    // USDA/HHS Dietary Guidelines for Americans 2020-2025 (fiber is listed as
    // a "nutrient of public health concern"; AI values ~25-38g/day by
    // sex/age, sourced from the IOM/NASEM DRI).
    sourceUrl:
      'https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf',
  },
  iron: {
    id: 'iron',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/',
  },
  calcium: {
    id: 'calcium',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/',
  },
  fat: {
    id: 'fat',
    underThreshold: 0.7,
    overThreshold: 1.0,
    // USDA/HHS Dietary Guidelines for Americans 2020-2025 — Acceptable
    // Macronutrient Distribution Range (AMDR) for total fat: 20-35% of
    // calories for adults.
    sourceUrl:
      'https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf',
  },
  potassium: {
    id: 'potassium',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/',
  },
  magnesium: {
    id: 'magnesium',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/',
  },
  zinc: {
    id: 'zinc',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/',
  },
  omega3: {
    id: 'omega3',
    underThreshold: 0.7,
    overThreshold: 1.0,
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/',
  },
  sodium: {
    id: 'sodium',
    overThreshold: 1.0,
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/sodium-reduction',
  },
  sugar: {
    id: 'sugar',
    overThreshold: 1.0,
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/sugars-and-dental-caries',
  },
  salt: {
    // Derived from sodium (salt g = sodium mg × 2.5 / 1000) — see
    // per100gValue('salt') in microBatteryEngine.ts.
    id: 'salt',
    overThreshold: 1.0,
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction',
  },
};

// Fixed display order for rows/sheets that enumerate every rule.
export const ASSESSMENT_ORDER: MicronutrientId[] = [
  'fiber',
  'iron',
  'calcium',
  'fat',
  'potassium',
  'magnesium',
  'zinc',
  'omega3',
  'sodium',
  'sugar',
  'salt',
];

// Single-nutrient assessment line, or null when nothing worth flagging
// (target <= 0, or the value sits comfortably between the two thresholds).
export function assessState(state: MicroBatteryState, language: Language): string | null {
  const rule = ASSESSMENT_RULES[state.id];
  if (!rule || state.target <= 0) return null;

  const ratio = state.current / state.target;

  if (rule.overThreshold !== undefined && ratio > rule.overThreshold) {
    const advice = translate(language, `nutrients.${state.id}.overAdvice`);
    if (advice) return advice;
  }
  if (rule.underThreshold !== undefined && ratio < rule.underThreshold) {
    const advice = translate(language, `nutrients.${state.id}.underAdvice`);
    if (advice) return advice;
  }
  return null;
}

// Joined assessment for one day's (or one week-average's) set of
// micro-battery states. Empty/all-fine → t('assessment.allGood') rather
// than an empty cell.
export function assessDay(states: MicroBatteryState[], language: Language): string {
  const lines = states.map((s) => assessState(s, language)).filter((l): l is string => l !== null);
  return lines.length === 0 ? translate(language, 'assessment.allGood') : lines.join(' ');
}
