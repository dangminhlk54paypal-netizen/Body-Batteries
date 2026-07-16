import type { MicronutrientId } from '../types/nutrition';

// Tolerable Upper Intake Level (UL) reference marks — adult population
// averages (IOM/NASEM, EFSA), used ONLY to power a gentle "you're over the
// suggested cap" notice (see domain/nutrition/overdoseWarning.ts). This is
// NOT a diagnosis or medical claim (see .ai/CONTEXT.md §5) — every mark
// below is reference-only. Display name is looked up by `id` from
// src/i18n/locales/*.ts (`nutrients.<id>.name`), not stored here.
//
// Nutrients without a well-established UL for typical dietary intake
// (fiber, omega3, fat, sugar, potassium) are intentionally absent from this
// map — computeOverdoseWarnings simply never fires for them.
export const UPPER_LIMITS: Partial<Record<MicronutrientId, { value: number; unit: 'g' | 'mg' }>> = {
  // IOM/NASEM adult UL. Reference only.
  iron: { value: 45, unit: 'mg' },
  // IOM/NASEM adult UL. Reference only.
  calcium: { value: 2500, unit: 'mg' },
  // IOM/NASEM adult UL. Reference only.
  zinc: { value: 40, unit: 'mg' },
  // IOM/NASEM UL applies to supplemental (non-food) magnesium only, but used
  // here as a simple combined reference mark. Reference only.
  magnesium: { value: 350, unit: 'mg' },
  // WHO/IOM high-intake reference mark (not a strict "UL" in the IOM sense,
  // but the commonly cited ceiling). Reference only.
  sodium: { value: 2300, unit: 'mg' },
  // Derived from the sodium mark above (2300mg × 2.5 / 1000). Reference only.
  salt: { value: 5.75, unit: 'g' },
};
