// Shared "what did the user weigh on day X" logic — used by both the Excel
// export (excelSheets.ts) and the History day-detail sheet, so the
// carry-forward rule stays identical in both places.

export interface WeightEntryLike {
  timestamp: number;
  value: number;
}

// End-of-day boundary (23:59:59.999 local time) for a YYYY-MM-DD key.
function endOfDayMs(dayKey: string): number {
  return new Date(dayKey + 'T23:59:59.999').getTime();
}

// Weight the user carried on `dayKey`: the most recent weight entry logged
// on or before that day (carry-forward). '' if none exists yet.
export function weightOnOrBefore(dayKey: string, weights: WeightEntryLike[]): number | string {
  const boundary = endOfDayMs(dayKey);
  let latest: WeightEntryLike | undefined;
  for (const w of weights) {
    if (w.timestamp <= boundary && (!latest || w.timestamp > latest.timestamp)) {
      latest = w;
    }
  }
  return latest ? latest.value : '';
}
