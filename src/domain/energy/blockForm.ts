import { resolveOneRepMax } from './blockEngine';
import { dateForWeekday, setVariationSets } from './blockPlanEdits';
import { planDayState, type PlanDayState } from './blockSessions';
import { findVariation } from '../../lib/powerliftingVariations';
import { LOCALE_TAGS, type Language } from '../../i18n/types';
import type { LiftingExercise, LiftingSet } from '../../types/energy';
import type { GeneratedBlockPlan, ResolvedDayPlan } from '../../types/powerliftingBlock';
import type { VariationAddress } from './blockPlanEdits';

// "Form": the owner's spreadsheet layout for editing a block — one lift at a
// time, its Training Max on top, then a row per week written
// "sets x reps @ weight" with each weight's % of that TM beside it. Rows can be
// typed in kg or in % of the TM ("5x5@81%"), and a new TM moves every session
// not yet trained so the % stay. Pure; BlockFormView.tsx draws it.

export interface FormLift {
  variationId: string;
  exercise: LiftingExercise;
}

export interface FormRow {
  at: VariationAddress;
  weekIndex: number;
  dayOfWeek: ResolvedDayPlan['dayOfWeek'];
  date: string | null;
  state: PlanDayState; // trained / not yet / taken off
  sets: LiftingSet[];
  userEdited: boolean;
  sameWeekCount: number; // sessions of this lift in the same week (> 1 → show the weekday)
}

export interface SetGroup {
  sets: number;
  reps: number;
  weightKg: number;
  pct: number | null; // % of the TM; null without a TM
  prime: boolean; // the warm-up single before the working sets
}

const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;

// Every variation the block trains, in the order it first appears.
export function formLifts(plan: GeneratedBlockPlan): FormLift[] {
  const seen = new Map<string, FormLift>();
  for (const week of plan.weeks) {
    for (const day of week.days) {
      for (const v of day.variations) {
        if (!seen.has(v.variation.variationId)) {
          seen.set(v.variation.variationId, { variationId: v.variation.variationId, exercise: v.variation.exercise });
        }
      }
    }
  }
  return [...seen.values()];
}

// The block's TM for one variation: the user's own, else the max its loads are
// taken of (the lift's 1RM × the variation's load factor) — the same number
// the Excel export prints as "Planned X (TM = …)".
export function blockTrainingMax(plan: GeneratedBlockPlan, variationId: string, exercise: LiftingExercise): number {
  const own = plan.config.trainingMax?.[variationId];
  if (own != null && own > 0) return own;
  const lift = resolveOneRepMax(plan.config.oneRepMax, plan.config.bodyWeightKg)[exercise].value;
  return Math.round(lift * (findVariation(variationId)?.loadFactor ?? 1) * 2) / 2;
}

export function buildFormRows(plan: GeneratedBlockPlan, variationId: string, lifted: Set<string> = new Set()): FormRow[] {
  const rows: FormRow[] = [];
  plan.weeks.forEach((week, weekIndex) => {
    const inWeek: FormRow[] = [];
    week.days.forEach((day, dayIndex) =>
      day.variations.forEach((v, variationIndex) => {
        if (v.variation.variationId !== variationId) return;
        inWeek.push({
          at: { weekIndex, dayIndex, variationIndex },
          weekIndex,
          dayOfWeek: day.dayOfWeek,
          date: dateForWeekday(week, day.dayOfWeek),
          state: planDayState(week, day, lifted),
          sets: v.sets,
          userEdited: Boolean(v.userEdited),
          sameWeekCount: 0,
        });
      })
    );
    rows.push(...inWeek.map((r) => ({ ...r, sameWeekCount: inWeek.length })));
  });
  return rows;
}

// Runs of equal sets → "5×5 @ 95". The prime is its own group.
export function setGroups(sets: LiftingSet[], tmKg: number): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const s of sets) {
    const prime = s.kind === 'warmup';
    const last = groups[groups.length - 1];
    if (last && !prime && !last.prime && last.reps === s.reps && last.weightKg === s.weightKg) {
      last.sets += 1;
      continue;
    }
    groups.push({
      sets: 1,
      reps: s.reps,
      weightKg: s.weightKg,
      pct: tmKg > 0 ? Math.round((s.weightKg / tmKg) * 100) : null,
      prime,
    });
  }
  return groups;
}

// The text a row's input starts with — the form "1x1@110 5x5@95" (a prime
// as "95 + …"), which parseSetNotation reads back unchanged.
export function formatFormText(sets: LiftingSet[], language: Language): string {
  const kg = (n: number) => n.toLocaleString(LOCALE_TAGS[language], { maximumFractionDigits: 2, useGrouping: false });
  const groups = setGroups(sets, 0);
  const prime = groups[0]?.prime ? `${kg(groups[0].weightKg)} + ` : '';
  const rest = groups.filter((g) => !g.prime).map((g) => `${g.sets}x${g.reps}@${kg(g.weightKg)}`);
  return prime + rest.join(' ');
}

// "5x5@81%" → "5x5@95" against a TM of 117.5 (rounded to 2.5 kg); a bare "94%"
// is a top single. Returns null when a % is typed but there is no TM.
export function resolvePercents(text: string, tmKg: number): string | null {
  const PCT = /(\d+(?:[.,]\d+)?)\s*%/g;
  if (!PCT.test(text)) return text;
  if (tmKg <= 0) return null;
  return text.replace(PCT, (_, n: string) => String(roundToPlate((tmKg * Number(n.replace(',', '.'))) / 100)));
}

// A new TM for one variation: every session not yet trained (and not taken
// off) moves its weights by new ÷ old, so each keeps its % of the TM; trained
// sessions stay as they were. The TM is stored on the block.
export function setBlockTrainingMax(
  plan: GeneratedBlockPlan,
  lift: FormLift,
  tmKg: number,
  heightCm: number,
  lifted: Set<string> = new Set()
): GeneratedBlockPlan {
  const old = blockTrainingMax(plan, lift.variationId, lift.exercise);
  let next: GeneratedBlockPlan = {
    ...plan,
    config: { ...plan.config, trainingMax: { ...(plan.config.trainingMax ?? {}), [lift.variationId]: tmKg } },
  };
  if (old <= 0 || old === tmKg) return next;
  const ratio = tmKg / old;
  for (const row of buildFormRows(plan, lift.variationId, lifted)) {
    if (row.state !== 'open' || row.sets.length === 0) continue;
    const sets = row.sets.map((s) => ({ ...s, weightKg: roundToPlate(s.weightKg * ratio) }));
    next = setVariationSets(next, row.at, sets, heightCm);
  }
  return next;
}

// Saves several rows at once (one write instead of one per row).
export function setFormRows(
  plan: GeneratedBlockPlan,
  edits: { at: VariationAddress; sets: LiftingSet[] }[],
  heightCm: number
): GeneratedBlockPlan {
  return edits.reduce((p, e) => setVariationSets(p, e.at, e.sets, heightCm), plan);
}
