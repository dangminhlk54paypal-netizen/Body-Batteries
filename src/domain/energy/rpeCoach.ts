import { setVariationSets } from './blockPlanEdits';
import { planDateOf } from './blockSessions';
import type { LiftingExercise, LiftingSet } from '../../types/energy';
import type { GeneratedBlockPlan, ResolvedVariationPlan } from '../../types/powerliftingBlock';

// "RPE coach": the lifter rates how hard each lift felt (RPE on the
// reps-in-reserve scale — 10 = nothing left, 8 = two reps left), and the
// coach compares it with what the plan aimed for. Rules, each from a source in
// docs/nghien-cuu/2026-10-23-tm-rpe-coach.md:
// - only TWO sessions in a row that miss the same way count (ACSM's
//   "two consecutive sessions"; RPE is least accurate far from failure, so one
//   rating alone is not enough);
// - too easy → more load (+2.5 kg bench, +5 kg squat/deadlift — inside ACSM's
//   2–10%), and while the lift's weekly working sets are under 10, one more set
//   (graded volume dose-response for muscle growth);
// - too hard → less load.
// It only SUGGESTS: nothing changes until the user taps Apply, and then only
// the weeks after the last rated session.

// 5 = "very easy, 5+ reps left" — the bottom of the useful range.
export const RPE_CHOICES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

// How far from the target counts as a miss, in RPE points.
const EASIER_BY = 1.5;
const HARDER_BY = 1;
const HARD_CEILING = 9.5; // a working set (not a test) at 9.5+ is too close to failure
const WEEKLY_SETS_FOR_GROWTH = 10;

export const LOAD_STEP_KG: Record<LiftingExercise, number> = { bench_press: 2.5, squat: 5, deadlift: 5 };

export interface RpeLog {
  weekIndex: number;
  dayIndex: number;
  variationIndex: number;
  date: string | null;
  target: number | null; // the plan's target RPE; null once the user rewrote the sets
  actual: number;
}

export interface CoachAdvice {
  key: string; // stable per (variation, last rated session) — for "dismiss"
  variationId: string;
  exercise: LiftingExercise;
  direction: 'easier' | 'harder'; // the sessions felt easier / harder than planned
  logs: [RpeLog, RpeLog]; // the two sessions behind it
  loadKg: number; // + or − per the direction
  offerSet: boolean; // easier, and the lift's weekly working sets are still under 10
  fromWeekIndex: number; // the first week a change would touch
}

const isTest = (v: ResolvedVariationPlan) => {
  const working = v.sets.filter((s) => s.kind === 'working');
  return working.length === 1 && working[0].reps === 1;
};

// The RPE the plan aimed for on this variation's last set, when it is still
// the app's own prescription.
export function targetRpeOf(v: ResolvedVariationPlan): number | null {
  if (v.userEdited || !v.reference) return null;
  const { method, targetRpe } = v.reference;
  return (method === 'rpe' || method === 'linear') && targetRpe > 0 ? targetRpe : null;
}

export function setVariationRpe(
  plan: GeneratedBlockPlan,
  at: { weekIndex: number; dayIndex: number; variationIndex: number },
  rpe: number | null
): GeneratedBlockPlan {
  return {
    ...plan,
    weeks: plan.weeks.map((w, wi) =>
      wi !== at.weekIndex
        ? w
        : {
            ...w,
            days: w.days.map((d, di) =>
              di !== at.dayIndex
                ? d
                : {
                    ...d,
                    variations: d.variations.map((v, vi) =>
                      vi !== at.variationIndex ? v : { ...v, actualRpe: rpe ?? undefined }
                    ),
                  }
            ),
          }
    ),
  };
}

// Every rated session of one variation, in plan order (tests left out).
export function rpeLogs(plan: GeneratedBlockPlan, variationId: string): RpeLog[] {
  const logs: RpeLog[] = [];
  plan.weeks.forEach((week, weekIndex) =>
    week.days.forEach((day, dayIndex) =>
      day.variations.forEach((v, variationIndex) => {
        if (v.variation.variationId !== variationId || v.actualRpe == null || isTest(v)) return;
        logs.push({
          weekIndex,
          dayIndex,
          variationIndex,
          date: planDateOf(week, day),
          target: targetRpeOf(v),
          actual: v.actualRpe,
        });
      })
    )
  );
  return logs;
}

function weeklyWorkingSets(plan: GeneratedBlockPlan, weekIndex: number, exercise: LiftingExercise): number {
  const week = plan.weeks[weekIndex];
  if (!week) return 0;
  return week.days
    .filter((d) => !d.skipped)
    .flatMap((d) => d.variations)
    .filter((v) => v.variation.exercise === exercise)
    .reduce((n, v) => n + v.sets.filter((s) => s.kind === 'working').length, 0);
}

export function coachAdvice(plan: GeneratedBlockPlan): CoachAdvice[] {
  const dismissed = new Set(plan.config.coachDismissed ?? []);
  const ids = [...new Set(plan.weeks.flatMap((w) => w.days.flatMap((d) => d.variations.map((v) => v.variation.variationId))))];
  const out: CoachAdvice[] = [];
  for (const variationId of ids) {
    const logs = rpeLogs(plan, variationId);
    if (logs.length < 2) continue;
    const pair: [RpeLog, RpeLog] = [logs[logs.length - 2], logs[logs.length - 1]];
    const fromWeekIndex = pair[1].weekIndex + 1;
    if (fromWeekIndex >= plan.weeks.length) continue; // nothing left to change
    const easier = pair.every((l) => l.target != null && l.actual <= l.target - EASIER_BY);
    const harder = pair.every((l) => (l.target != null && l.actual >= l.target + HARDER_BY) || l.actual >= HARD_CEILING);
    if (!easier && !harder) continue;
    const last = pair[1];
    const key = `${variationId}@${last.weekIndex}.${last.dayIndex}`;
    if (dismissed.has(key)) continue;
    const exercise = plan.weeks[last.weekIndex].days[last.dayIndex].variations[last.variationIndex].variation.exercise;
    out.push({
      key,
      variationId,
      exercise,
      direction: easier ? 'easier' : 'harder',
      logs: pair,
      loadKg: (easier ? 1 : -1) * LOAD_STEP_KG[exercise],
      offerSet: easier && weeklyWorkingSets(plan, fromWeekIndex, exercise) < WEEKLY_SETS_FOR_GROWTH,
      fromWeekIndex,
    });
  }
  return out;
}

const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;

// The user tapped Apply: every session of `variationId` from `fromWeekIndex`
// on (days taken off left alone) gets `kg` on its working sets and/or one set
// more (a copy of its last working set) or fewer. The prime stays as it is.
export function applyCoachChange(
  plan: GeneratedBlockPlan,
  variationId: string,
  fromWeekIndex: number,
  change: { kg?: number; sets?: number },
  heightCm: number
): GeneratedBlockPlan {
  let next = plan;
  plan.weeks.forEach((week, weekIndex) => {
    if (weekIndex < fromWeekIndex || week.skipped) return;
    week.days.forEach((day, dayIndex) => {
      if (day.skipped) return;
      day.variations.forEach((v, variationIndex) => {
        if (v.variation.variationId !== variationId || v.sets.length === 0) return;
        let sets: LiftingSet[] = v.sets.map((s) =>
          s.kind === 'working' && change.kg ? { ...s, weightKg: Math.max(0, roundToPlate(s.weightKg + change.kg)) } : s
        );
        const working = sets.filter((s) => s.kind === 'working');
        if (change.sets && change.sets > 0 && working.length > 0) {
          sets = [...sets, ...Array.from({ length: change.sets }, () => ({ ...working[working.length - 1] }))];
        } else if (change.sets && change.sets < 0 && working.length > 1) {
          sets = sets.slice(0, sets.length - Math.min(-change.sets, working.length - 1));
        }
        next = setVariationSets(next, { weekIndex, dayIndex, variationIndex }, sets, heightCm);
      });
    });
  });
  return next;
}

export function dismissAdvice(plan: GeneratedBlockPlan, key: string): GeneratedBlockPlan {
  const list = plan.config.coachDismissed ?? [];
  return list.includes(key) ? plan : { ...plan, config: { ...plan.config, coachDismissed: [...list, key] } };
}
