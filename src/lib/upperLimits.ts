import type { MicronutrientId } from '../types/nutrition';

// Tolerable Upper Intake Level (UL) reference marks — adult population
// averages (IOM/NASEM, EFSA), used ONLY to power a gentle "you're over the
// suggested cap" notice (see domain/nutrition/overdoseWarning.ts). This is
// NOT a diagnosis or medical claim (see .ai/CONTEXT.md §5) — every mark
// below is "Chỉ để tham khảo" (reference only).
//
// Nutrients without a well-established UL for typical dietary intake
// (fiber, omega3, fat, sugar, potassium) are intentionally absent from this
// map — computeOverdoseWarnings simply never fires for them.
export const UPPER_LIMITS: Partial<
  Record<MicronutrientId, { value: number; unit: 'g' | 'mg'; nameVi: string }>
> = {
  // IOM/NASEM adult UL. Chỉ để tham khảo.
  iron: { value: 45, unit: 'mg', nameVi: 'Sắt' },
  // IOM/NASEM adult UL. Chỉ để tham khảo.
  calcium: { value: 2500, unit: 'mg', nameVi: 'Canxi' },
  // IOM/NASEM adult UL. Chỉ để tham khảo.
  zinc: { value: 40, unit: 'mg', nameVi: 'Kẽm' },
  // IOM/NASEM UL applies to supplemental (non-food) magnesium only, but used
  // here as a simple combined reference mark. Chỉ để tham khảo.
  magnesium: { value: 350, unit: 'mg', nameVi: 'Magie' },
  // WHO/IOM high-intake reference mark (not a strict "UL" in the IOM sense,
  // but the commonly cited ceiling). Chỉ để tham khảo.
  sodium: { value: 2300, unit: 'mg', nameVi: 'Natri' },
  // Derived from the sodium mark above (2300mg × 2.5 / 1000). Chỉ để tham khảo.
  salt: { value: 5.75, unit: 'g', nameVi: 'Muối (NaCl)' },
};
