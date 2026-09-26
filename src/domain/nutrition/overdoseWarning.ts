import { UPPER_LIMITS } from '../../lib/upperLimits';
import type { MicroBatteryState } from '../../types/nutrition';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Pure overdose-warning engine (no I/O) — flags micronutrients whose today
// total has crossed their Tolerable Upper Intake Level (see
// lib/upperLimits.ts). Deliberately gentle, referential wording only (see
// .ai/CONTEXT.md §5): never diagnostic, never alarming/medical-claim
// language — see t('overdose.message') in src/i18n/locales/*.ts.
// Gentle "past a reference ceiling" flag — deliberately narrower than the
// existing caption logic (kind==='goal' && over just means "past the daily
// recommendation", which is fine/neutral and must NOT warn, see CONTEXT.md
// §5). A goal-type nutrient only warns once it clears the separate Upper
// Limit table; a limit-type nutrient (sodium/sugar/salt) warns as soon as
// it's over its own cap, same as `state.over`.
export function isOverReference(state: MicroBatteryState): boolean {
  if (state.kind === 'limit') return state.over;
  return state.current > (UPPER_LIMITS[state.id]?.value ?? Infinity);
}

export interface OverdoseWarning {
  id: MicroBatteryState['id'];
  name: string;
  current: number;
  limit: number;
  unit: 'g' | 'mg';
  message: string;
}

function buildMessage(
  language: Language,
  name: string,
  current: number,
  limit: number,
  unit: string
): string {
  return translate(language, 'overdose.message', { name, current, unit, limit });
}

export function computeOverdoseWarnings(
  micros: MicroBatteryState[],
  language: Language
): OverdoseWarning[] {
  const warnings: OverdoseWarning[] = [];

  // Salt is purely derived from sodium (salt_g = sodium_mg * 2.5/1000, see
  // microBatteryEngine.ts) and its UL is the same sodium UL converted to
  // grams (see upperLimits.ts) — so crossing one always crosses the other at
  // the exact same measurement. Showing both is redundant; salt is the more
  // user-facing label (shown first in the "Muối & điện giải" group), so skip
  // sodium whenever salt already fired.
  const saltExceeds = micros.some((m) => {
    const ul = UPPER_LIMITS[m.id];
    return m.id === 'salt' && ul && m.current > ul.value;
  });

  for (const micro of micros) {
    if (micro.id === 'sodium' && saltExceeds) continue;

    const ul = UPPER_LIMITS[micro.id];
    if (!ul) continue; // no defined upper limit for this nutrient — never fires
    if (micro.current <= ul.value) continue;

    const name = translate(language, `nutrients.${micro.id}.name`);
    warnings.push({
      id: micro.id,
      name,
      current: micro.current,
      limit: ul.value,
      unit: ul.unit,
      message: buildMessage(language, name, micro.current, ul.value, ul.unit),
    });
  }

  return warnings;
}
