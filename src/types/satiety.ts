// Types for the "satiety" (fullness/hunger) battery — S-O spec. This is a
// short-term kcal reserve, separate from the daily "energy" battery: it does
// NOT reset at a day boundary, it just drains continuously and refills when
// the user eats. See .ai/parallel-reports/S-O-satiety-battery-spec.md.

export interface SatietyReading {
  reserveKcal: number; // 0..FULLNESS_CAPACITY_KCAL, persisted continuously
}
