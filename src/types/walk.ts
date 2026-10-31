// One "ra khỏi nhà" outing: started when the user taps "Ra khỏi nhà", finished
// when they tap "Về nhà". Steps come from the phone pedometer (on iPhone this is
// the same CoreMotion source Apple Health records).
export interface WalkSession {
  id: string;
  date: string; // YYYY-MM-DD (local) of startedAt — the day the outing counts toward
  startedAt: number; // unix ms
  endedAt: number | null; // null while still outside
  steps: number;
}

export interface DailyWalkTotal {
  date: string;
  steps: number;
  outings: number; // finished outings that day
}
