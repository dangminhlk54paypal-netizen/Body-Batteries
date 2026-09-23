import { mergeEditedWorkouts } from '../entryEdit';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

const sets: LiftingSet[] = [{ kind: 'working', weightKg: 100, reps: 5 }];
const squat: WorkoutSession = { type: 'squat', minutes: 20, sets };
const run: WorkoutSession = { type: 'running', minutes: 30 };
const bb: WorkoutSession = { type: 'bodybuilding', minutes: 15, sets, bbMet: 4, bbExerciseId: 'x' };
const oldSquat: WorkoutSession = { type: 'squat', minutes: 45 }; // logged before sets existed

const entry = (workouts: WorkoutSession[]): ActivityLogEntry => ({
  id: 'a',
  timestamp: 1,
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-08-26',
});

describe('mergeEditedWorkouts', () => {
  const edited: WorkoutSession[] = [{ type: 'squat', minutes: 25, sets: [{ kind: 'working', weightKg: 110, reps: 5 }] }];

  it('replaces the lifting sessions and keeps a run logged in the same entry', () => {
    const merged = mergeEditedWorkouts(entry([squat, run]), 'lifting', edited);
    expect(merged).toEqual([...edited, run]);
  });

  it('keeps bodybuilding sessions when the powerlifting sheet edits the entry', () => {
    const merged = mergeEditedWorkouts(entry([squat, bb]), 'lifting', edited);
    expect(merged).toContain(bb);
    expect(merged).not.toContain(squat);
  });

  it('a bodybuilding edit replaces bb sessions and keeps the lifts and the run', () => {
    const newBb: WorkoutSession[] = [{ ...bb, bbExerciseId: 'y' }];
    const merged = mergeEditedWorkouts(entry([bb, squat, run]), 'bodybuilding', newBb);
    expect(merged).toEqual([...newBb, squat, run]);
  });

  it('a minutes-only lift (no sets) is not managed by the sheet, so it is kept', () => {
    expect(mergeEditedWorkouts(entry([oldSquat]), 'lifting', edited)).toEqual([...edited, oldSquat]);
  });

  it('an entry with only lifts becomes exactly the edited sessions', () => {
    expect(mergeEditedWorkouts(entry([squat]), 'lifting', edited)).toEqual(edited);
  });
});
