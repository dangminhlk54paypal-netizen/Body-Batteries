import {
  OWNER_NOTES_IMPORT_LANGUAGE as language,
  OWNER_NOTES_IMPORT_TEXT,
  buildOwnerImportPeriod,
  keepUnmentionedMovements,
} from '../ownerNotesImport';
import { parsePageText } from '../trainingLogPageEdit';
import { planDaySync } from '../trainingLogDaySync';
import { DEFAULT_TRAINING_LOG_FORMAT as format } from '../../../types/trainingLog';
import type { ActivityLogEntry, WorkoutSession } from '../../../types/energy';

const today = '2026-10-01';

function parseImport() {
  const { period, page } = buildOwnerImportPeriod(language);
  return parsePageText({
    page,
    text: OWNER_NOTES_IMPORT_TEXT,
    rangeStart: period.startDate,
    rangeEnd: period.endDate,
    today,
    language,
  });
}

describe('owner Notes import', () => {
  it('covers every Monday–Sunday week from 27.04 to 30.08', () => {
    const { period, page } = buildOwnerImportPeriod(language);
    expect(period.weeks).toHaveLength(18);
    expect(page.weeks[0].range).toBe('27.04–03.05');
    expect(page.weeks[17].range).toBe('24.08–30.08');
  });

  it('reads 58 training days, every one a full Xả session', () => {
    const diff = parseImport();
    expect(diff.invalidDates).toEqual([]);
    expect(diff.title).toBeNull();
    expect(diff.days).toHaveLength(58);
    for (const d of diff.days) {
      const plan = planDaySync({ date: d.date, entries: [], newBody: d.after!.body, format, language });
      expect({ date: d.date, kind: plan.kind }).toEqual({ date: d.date, kind: 'create' });
    }
  });

  it('keeps unclear bits as the day note, verbatim', () => {
    const notes = Object.fromEntries(parseImport().days.map((d) => [d.date, d.after!.note]));
    expect(notes['2026-05-15']).toBe('& vai 4x6x30 [?]');
    expect(notes['2026-06-16']).toBe('P [?] (gốc: B 92.5 P 4x4x80)');
    expect(notes['2026-08-26']).toBe('PD (+8) [?]');
  });

  it('labels every week and sets the owner’s notes and weights', () => {
    const diff = parseImport();
    expect(diff.weekLabels.map((w) => w.after)).toEqual([
      'B0W1', 'B0W2', 'B0W3', 'B0W4', 'B0 Deload',
      'B1W1', 'B1W2', 'B1W3', 'B1W4', 'B1W5', 'B1W6', 'B1 Deload', 'Holiday',
      'B2W1', 'B2W2', 'B2W3', 'B2W4', 'B2W5',
    ]);
    expect(diff.weekWeights.map((w) => [w.weekStart, w.after])).toEqual([
      ['2026-08-17', 77.5],
      ['2026-08-24', 77],
    ]);
    const notes = Object.fromEntries(diff.weekNotes.map((w) => [w.weekStart, w.after]));
    expect(Object.keys(notes)).toHaveLength(6);
    expect(notes['2026-06-29']).toBe('BurnOUT\nFinished Block in 79kg BW, SBD 100-120-140');
    // "28.08 - …" in a week note must not be read as a second 28.08 day line.
    expect(notes['2026-08-24']).toMatch(/^28\.08 - B 8x20/);
  });
});

describe('keepUnmentionedMovements', () => {
  const bench: WorkoutSession = {
    type: 'bench_press',
    minutes: 20,
    sets: [{ kind: 'working', reps: 5, weightKg: 70 }],
  };
  const squat: WorkoutSession = {
    type: 'squat',
    minutes: 20,
    sets: [{ kind: 'working', reps: 5, weightKg: 100 }],
  };
  const entry = (workouts: WorkoutSession[]): ActivityLogEntry => ({
    id: 'e1',
    timestamp: new Date('2026-08-03T18:00:00').getTime(),
    steps: 0,
    workouts,
    energyKcal: 0,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-08-03',
  });

  it('leaves the line alone on a day without Xả', () => {
    expect(keepUnmentionedMovements('B 90 + 5x5x70', [], format, language)).toBe('B 90 + 5x5x70');
  });

  it('appends a logged lift the line does not mention, so the sync keeps it', () => {
    const body = keepUnmentionedMovements('B 90 + 5x5x70 IC 5x5x60', [entry([bench, squat])], format, language);
    expect(body).toBe('B 90 + 5x5x70 IC 5x5x60 S 5x100');
    const plan = planDaySync({ date: '2026-08-03', entries: [entry([bench, squat])], newBody: body, format, language });
    expect(plan.kind).toBe('sync');
    if (plan.kind !== 'sync') return;
    const types = plan.updates.flatMap((u) => u.workouts.map((w) => w.variationId ?? w.type));
    expect(types).toEqual(['bench_press', 'bench_incline', 'squat']); // bench rewritten, IC added, squat kept
  });
});
