import { addDaysToDateString } from '../../lib/dateUtils';
import type { Language } from '../../i18n/types';
import type { ActivityLogEntry } from '../../types/energy';
import type { TrainingLogFormat, TrainingLogPeriod, TrainingLogWeek } from '../../types/trainingLog';
import { formatMovement, formatWeekRange } from './trainingLogFormatter';
import { identityOfWorkout, parseDayBody, sameIdentity } from './trainingLogParser';
import type { PeriodPage } from './trainingLogPage';

// TEMPORARY — one-time import of the owner's Apple Notes training log
// (Block 0 → Block 2, 01.05–30.08.2026) into the Training Log, requested by the
// owner on 2026-10-01 instead of pasting it on the 📄 page by hand. It goes
// through the very same page-edit pipeline (parsePageText → planPageEdit →
// applyPageEdit), so every day becomes a normal Xả session and every week gets
// the owner's label / note / weight. Remove this file, its service and the
// App.tsx hook once the owner has confirmed the data on the phone.

// The text is written in the vi page layout (dd.mm, vi abbreviations), so it
// is always read as vi whatever the app language is.
export const OWNER_NOTES_IMPORT_LANGUAGE: Language = 'vi';
export const OWNER_NOTES_IMPORT_START = '2026-04-27'; // Monday of the first week
export const OWNER_NOTES_IMPORT_END = '2026-08-30'; // Sunday of the last week

export const OWNER_NOTES_IMPORT_TEXT = `
B0W1: 27.04–03.05
01.05: B 87.5 + 4x4(+1)x75

B0W2: 04.05–10.05
04.05: B 90 + 4x4x70 IC 4x5x60
07.05: B 90 + 1x4x75+3x4(+2)x77.5 LG 4x6x62.5

B0W3: 11.05–17.05
11.05: B 85 + 5x4x72.5 IC 4x6x65 (hold+acce)
15.05: B 87.5 + 5x3x80 (s1.8.5,s4.8.0,s5-r4-9.5) LG 4x6x70
& vai 4x6x30 [?]

B0W4: 18.05–24.05
18.05: B 92.5 + 5x3(+3)x75 IC 4x6x67.5
22.05: B 87.5 + 5x3x80 (+2 rpe:8.5) LG 4x6x70 (1set:nlz suýt hẹo vì cổ tay)
24.05: D 100 + 4x4x90 S 100 + 5x3x80
[?] (gốc ghi: w5, 100kg max deadlift +squat)

B0 Deload: 25.05–31.05
Skip leg on Sunday
26.05: B 90 + 4x4x72.5 IC 4x6x60
27.05: S 80 + 3x6x60 D 100 + 3x6x60
29.05: B 85 + 4x5x72.5 LG 4x5x60

B1W1: 01.06–07.06
01.06: B 90 + 4x5(+1)x75 IC 4x6x60
03.06: S 95 + 4x5x80 PD 115 + 3x3x75 D 5x90
04.06: B 90 + 4x5x75 LG 4x6x65
07.06: S 90 + 4x5x75 PD 120 + 3x90+3x3x95

B1W2: 08.06–14.06
08.06: B 92.5 + 4x5x75 IC 4x6x65
10.06: S 105 + 4x5x80 PD 120 + 3x3x80 D 2x4x95
12.06: B 90 + 4x5x78.5 LG 4x6x67.5

B1W3: 15.06–21.06
15.06: D 125 + 4x4x100 PS 110 + 4x4x85
16.06: B 92.5 + 4x4x80 IC 4x6x62.5
P [?] (gốc: B 92.5 P 4x4x80)
17.06: S 120 + 4x4x95 D 120 + 4x4x90
19.06: B 90 + 5x3x82.5 LG 4x6x70
+2x1 [?] (gốc: B 90 5x3x82.5+2x1)
21.06: D 125 + 4x4x105 S 120 + 4x4x90

B1W4: 22.06–28.06
Wu: 6x 60 3x90 120 140 ❌ vỡ - not4me
<Next time> 6-60 3x80 2x100 1x 120 1x135 1x145 (real : 145 ❌ 140 ✅)
22.06: B 95 + 5x3x82.5 IC 4x6x70
24.06: S 120 + 4x3x100 PD 140 + 4x4x100
26.06: B 95 + 4x3x85 LG 4x6x72.5
28.06: D 130 + 3x115+3x3x120 PS 120 + 4x4x90

B1W5: 29.06–05.07
BurnOUT
Finished Block in 79kg BW, SBD 100-120-140
29.06: B 95 + 3x2x85+2x3x85 IC 4x6x65
02.07: S 120 + 3x3x107.5+4x102.5 PD 140 + 3x4x100
03.07: B 100 + 90x(2+3+2+2) LG 4x6x75
05.07: D 140 + 3x3x125+2x125 PS 110 + 4x5x90

B1W6: 06.07–12.07
06.07: B 90 + 5x3x77.5 IC 4x5x60
09.07: S 110 + 90x(1+4)+4x5x80 PD 120 + 4x5x90
10.07: B 92.5 + 4x4x77.5 LG 4x6x65
12.07: D 120 + 5x4x100 PS 110 + 4x5x85

B1 Deload: 13.07–19.07
15.07: S 80 + 4x5x62.5 PD 95 + 4x5x75
17.07: B 75 + 4x5x60 IC 4x6x50

Holiday: 20.07–26.07
———oneweekHOLIDAYS———
26.07: D 100 + 5x5x80 PS 90 + 5x5x70

B2W1: 27.07–02.08
Cảm giác quá tải thần kinh, có lẽ bởi khối bài tập PS cuối
27.07: B 90 + 5x5x72.5 IC 5x5x62.5
29.07: S 110 + 5x5x85 PD 120 + 5x6x85
31.07: B 95 + 5x5x77.5 LG 5x6x65
02.08: D 132.5 + 5x5x105 PS 110 + 5x5x80

B2W2: 03.08–09.08
03.08: B 90 + 5x5x70 IC 5x5x60
05.08: S 115 + 5x5x90 PD 100 + 4x3x80
07.08: B 95 + 5x5x80 LG 4x6x65
09.08: D 132.5 + 5x5x107.5 PS 5x5x70

B2W3: 10.08–16.08
11.08: B 95 + 5x5x72.5 IC 4x6x60
12.08: S 115 + 5x5x95 PD 4x3x80
PD [?]
14.08: B 90 + 5x5x75 LG 5x6x65
16.08: D 140 + 6x4x110 PS 5x4x80

B2W4: 17.08–23.08 77.5kg
17.08: B 95 + 6x4(+3)x75 IC 4x6x60
19.08: S 120 + 110x(4+5+5+4+8) PD 130 + 5x4x95
21.08: B 95 + 5x4x82.5 LG 4x6x67.5
23.08: D 135 + 5x4x115 PS 4x4x60

B2W5: 24.08–30.08 77kg
28.08 - B 8x20+6x60+3x80 + 90+ 97.5 +102.5 ❌ + 100 (4x2+5)x90 LG 3x6x70 [?]
30.08 - warmU deadlift 6x60-3x100-125-142-150-155 (test)
24.08: B 95 + 5x3x82.5 IC 4x6x65
26.08: S 130 + 4x3x115+3x100 PD 130 + 4x3x100
PD (+8) [?]
28.08: B 100 + 4x2x90+5x90 LG 3x6x70
30.08: D 155 + 122.5x(2+2+2+5+6) PS 125 + 4x90+4x95+4x100 S 6x105

`;

// Every Monday–Sunday week of the import range, as an (empty) notebook period,
// and the matching page with no days: the import text then reads as "new"
// days, week labels, notes and weights. Week notes start empty so a week the
// text says nothing about keeps whatever note it already has.
export function buildOwnerImportPeriod(language: Language): { period: TrainingLogPeriod; page: PeriodPage } {
  const weeks: TrainingLogWeek[] = [];
  for (let monday = OWNER_NOTES_IMPORT_START; monday <= OWNER_NOTES_IMPORT_END; monday = addDaysToDateString(monday, 7)) {
    weeks.push({ weekStart: monday, weekEnd: addDaysToDateString(monday, 6), sessions: 0, dates: [] });
  }
  const period: TrainingLogPeriod = {
    key: 'month:2026-04',
    monthKey: '2026-04',
    blocks: [],
    startDate: OWNER_NOTES_IMPORT_START,
    endDate: OWNER_NOTES_IMPORT_END,
    sessions: 0,
    weeks,
  };
  const page: PeriodPage = {
    title: '',
    weeks: weeks.map((w) => {
      const range = formatWeekRange(w, language);
      return {
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        label: range,
        heading: range,
        note: '',
        range,
        defaultLabel: '',
        customLabel: '',
        weightKg: null,
      };
    }),
    days: [],
    text: '',
    manualDates: [],
  };
  return { period, page };
}

// A day that already has Xả sessions: the page editor treats the line as the
// whole truth and would drop any lift it does not mention. The owner asked for
// the opposite — no duplicates, only add what is missing — so every logged
// movement the import line does not cover (another lift, a bodybuilding or
// cardio session) is appended to the line exactly as the notebook prints it,
// which the day sync keeps untouched.
export function keepUnmentionedMovements(
  body: string,
  entries: ActivityLogEntry[],
  format: TrainingLogFormat,
  language: Language
): string {
  const known = entries.flatMap((e) => e.workouts);
  if (known.length === 0) return body;
  const mentioned = parseDayBody(body, { format, language, known })
    .movements.map((m) => m.identity)
    .filter((id) => id != null);
  const kept = known
    .filter((w) => {
      const id = identityOfWorkout(w);
      return id == null || !mentioned.some((m) => sameIdentity(m, id));
    })
    .map((w) => formatMovement(w, format, language))
    .filter((text) => text.trim() !== '');
  return kept.length > 0 ? `${body} ${kept.join(' ')}` : body;
}
