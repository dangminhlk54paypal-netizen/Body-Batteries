// Reference marks for the active substances tracked from energy drinks,
// coffee and sports supplements (caffeine, taurine, L-carnitine, creatine).
// Like lib/upperLimits.ts these are population-level reference points for a
// gentle "past the mark" notice — NOT a diagnosis or a personal prescription
// (.ai/CONTEXT.md §5). Every figure is sourced in
// docs/nghien-cuu/2026-10-26-caffeine-nuoc-tang-luc-va-tpcn.md.

export type SubstanceId = 'caffeine' | 'taurine' | 'carnitine' | 'creatine';

export const SUBSTANCE_IDS: SubstanceId[] = ['caffeine', 'taurine', 'carnitine', 'creatine'];

// EFSA 2015: habitual intakes up to 400 mg/day raise no safety concern for
// healthy non-pregnant adults; single doses up to 200 mg (≈3 mg/kg) likewise.
export const CAFFEINE_DAILY_LIMIT_MG = 400;
export const CAFFEINE_SINGLE_DOSE_MG = 200;

// What counts as "one dose": every caffeinated item logged within this many
// minutes. Our own grouping (two cans back-to-back act as one dose), not a
// figure from EFSA.
export const CAFFEINE_DOSE_WINDOW_MIN = 60;

// EFSA 2015: a single 100 mg dose may affect sleep in some adults when taken
// close to bedtime. Drake et al. 2013: caffeine 6 h before bed still
// disrupted sleep, supporting a ≥ 6 h caffeine-free gap.
export const CAFFEINE_LATE_MG = 100;
export const CAFFEINE_SLEEP_GAP_H = 6;

// ISSN 2021: 3–6 mg/kg body mass improves exercise performance, most often
// taken ~60 min before; ~9 mg/kg brings a high rate of side effects.
export const CAFFEINE_PERFORMANCE_MG_PER_KG = { min: 3, max: 6 } as const;
export const CAFFEINE_PRE_WORKOUT_MIN = 60;

// EFSA 2009 (taurine in energy drinks): the high acute consumption it
// assessed was 3 cans × 250 ml × 4000 mg/L = 3000 mg/day, judged not a
// safety concern. Past it = past what was assessed, not "toxic".
export const TAURINE_REFERENCE_MG = 3000;

// Hathcock & Shao 2006: observed safe level for chronic L-carnitine intake.
export const CARNITINE_OSL_MG = 2000;

// ISSN 2017 (creatine): maintenance 3–5 g/day after a 5–7 day loading phase
// of ~20 g/day (4 × 5 g). Above the loading dose = above common practice.
export const CREATINE_MAINTENANCE_MG = { min: 3000, max: 5000 } as const;
export const CREATINE_LOADING_MG = 20000;

// The daily mark each substance is shown against on Home.
export const SUBSTANCE_DAILY_MARK_MG: Record<SubstanceId, number> = {
  caffeine: CAFFEINE_DAILY_LIMIT_MG,
  taurine: TAURINE_REFERENCE_MG,
  carnitine: CARNITINE_OSL_MG,
  creatine: CREATINE_MAINTENANCE_MG.max,
};

// "Becoming a habit": this many of the last 7 days over a mark. Our own
// threshold for a gentle long-term note, not a sourced figure.
export const HABIT_DAYS_THRESHOLD = 3;

// Default bedtime (hour of day) until the user sets theirs on the ☕ panel.
export const DEFAULT_BEDTIME_HOUR = 23;
