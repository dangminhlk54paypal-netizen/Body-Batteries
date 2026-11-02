import { activityEditField, activityPatchFor, editableIntakes, entryTimestampFor, isEditableDay } from '../dayLogEdit';
import type { ActivityLogEntry } from '../../../types/energy';
import type { IntakeEvent } from '../../../types/battery';

const activity = (patch: Partial<ActivityLogEntry>) =>
  ({ id: 'a', timestamp: 1, steps: 0, workouts: [], energyKcal: 0, satietyDrainKcal: 0, energyDayApplied: 'x', ...patch } as ActivityLogEntry);

describe('isEditableDay', () => {
  it('covers today and the 3 days before it', () => {
    expect(isEditableDay('2026-11-02', '2026-11-02')).toBe(true);
    expect(isEditableDay('2026-10-30', '2026-11-02')).toBe(true);
    expect(isEditableDay('2026-10-29', '2026-11-02')).toBe(false);
    expect(isEditableDay('2026-11-03', '2026-11-02')).toBe(false);
  });
});

describe('entryTimestampFor', () => {
  it('uses now for today and noon for a past day', () => {
    expect(entryTimestampFor('2026-11-02', '2026-11-02', 123)).toBe(123);
    expect(new Date(entryTimestampFor('2026-11-01', '2026-11-02', 123)).getHours()).toBe(12);
  });
});

describe('editableIntakes', () => {
  const ev = (batteryTypeId: IntakeEvent['batteryTypeId'], note: string, amount = 100) =>
    ({ id: `${batteryTypeId}${note}`, timestamp: 1, batteryTypeId, amount, note } as IntakeEvent);
  it('keeps hand-logged rows, drops derived ones', () => {
    const kept = editableIntakes([
      ev('water', ''),
      ev('sleep', 'nap'),
      ev('movement', 'steps'),
      ev('energy', 'workout: walking 30m'),
      ev('water', '', -100),
    ]);
    expect(kept.map((e) => e.batteryTypeId)).toEqual(['water', 'sleep']);
  });
});

describe('activityEditField', () => {
  it('edits steps of a steps-only row', () => {
    const field = activityEditField(activity({ steps: 5000 }))!;
    expect(field).toEqual({ kind: 'steps', value: 5000 });
    expect(activityPatchFor(field, 6000)).toEqual({ steps: 6000 });
  });

  it('edits minutes of one timed workout and keeps the rest of it', () => {
    const session = { type: 'walking' as const, minutes: 30 };
    const field = activityEditField(activity({ workouts: [session] }))!;
    expect(activityPatchFor(field, 45)).toEqual({ workouts: [{ type: 'walking', minutes: 45 }] });
  });

  it('leaves set-based and mixed rows to the training log', () => {
    const sets = [{ weightKg: 100, reps: 5 }];
    expect(activityEditField(activity({ workouts: [{ type: 'squat', minutes: 0, sets }] as never }))).toBeNull();
    expect(activityEditField(activity({ steps: 10, workouts: [{ type: 'walking', minutes: 5 }] }))).toBeNull();
  });
});
