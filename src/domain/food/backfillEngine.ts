// Pure engine for "cập nhật lịch sử" — backfilling a food entry into a PAST
// day's readings. No I/O, no store, no DB: every function here is a plain
// data transform, unit-tested in isolation. See
// .ai/parallel-reports/S-S-backfill-spec.md sections 3d (API contract) and 4
// (invariants) for the full design this file implements. Callers (S-S4, the
// energyStore actions) own all persistence/day-lookup concerns; this file
// only ever sees the readings/entries handed to it.

import type { BatteryReading, BatteryId } from '../../types/battery';
import type { ModeDefinition } from '../../types/modes';
import type { UserProfile } from '../../types/energy';
import type { FoodLogEntry } from '../../types/food';
import type { PortionNutrition } from './foodNutrition';
import { createDailyReading, applyIntake } from '../battery/batteryEngine';
import { createEnergyReading, chargeEnergy, burnEnergy } from '../energy/energyBalanceEngine';
import { dailyCalorieTarget } from '../energy/weightGoal';
import { DEFAULT_BATTERIES, DATA_RETENTION_DAYS } from '../../lib/constants';

// ---------------------------------------------------------------------------
// validateBackfillDate
// ---------------------------------------------------------------------------

export type BackfillDateError = 'future' | 'too-old' | 'invalid';

const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parses a strict "YYYY-MM-DD" string into a UTC-midnight Date, rejecting
// malformed strings and calendar rollovers (e.g. "2026-02-30" silently
// becoming March 2nd in the native Date constructor).
function parseCalendarDate(dateStr: string): Date | null {
  if (!DATE_STR_RE.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const rolledOver =
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day;
  return rolledOver ? null : date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Whether `dateStr` is a legal backfill target relative to `today` (both
// "YYYY-MM-DD"). Rejects the future (nothing to backfill yet), anything older
// than `maxDays` (default DATA_RETENTION_DAYS — cleanupService sweeps data
// that old anyway, so backfilling it would be pointless), and malformed
// strings. `today === dateStr` is a legal ("hôm nay") target — callers that
// want to route same-day writes through the normal `logFood` path do that
// check themselves, not here.
export function validateBackfillDate(
  dateStr: string,
  today: string,
  maxDays: number = DATA_RETENTION_DAYS
): { ok: true } | { ok: false; reason: BackfillDateError } {
  const target = parseCalendarDate(dateStr);
  const todayDate = parseCalendarDate(today);
  if (!target || !todayDate) {
    return { ok: false, reason: 'invalid' };
  }

  const daysAgo = Math.round((todayDate.getTime() - target.getTime()) / DAY_MS);
  if (daysAgo < 0) {
    return { ok: false, reason: 'future' };
  }
  if (daysAgo > maxDays) {
    return { ok: false, reason: 'too-old' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// applyFoodToDayReadings / reverseFoodOnDayReadings
// ---------------------------------------------------------------------------

// Which nutrient battery each nutrition field feeds — mirrors the charge map
// in energyStore.logFood/removeFood (nutrientCharges/reverseCharges). Shared
// by both directions below since FoodLogEntry and PortionNutrition use the
// same field names for these four macros.
function nutrientCharges(n: {
  proteinG: number;
  carbG: number;
  waterG: number;
  mineralsMg: number;
}): Partial<Record<BatteryId, number>> {
  return {
    protein: n.proteinG,
    carbs: n.carbG,
    water: n.waterG,
    minerals: n.mineralsMg,
  };
}

// Charges one food portion's nutrition into a day's readings: protein/carbs/
// water/minerals via applyIntake, energy via chargeEnergy. Mirrors
// energyStore.logFood's charging logic exactly, MINUS the satiety top-up
// (eatIntoReserve) it also applies there — a backfilled meal for a past day
// must never touch the continuous, real-time satietyReserveKcal/
// lastSatietySyncAt fields (spec section 2). chargeEnergy itself never
// touches those fields, so simply not calling eatIntoReserve here already
// satisfies the invariant; readings without a matching batteryTypeId (e.g. a
// nutrients-only array with no energy row) pass through unchanged.
export function applyFoodToDayReadings(
  readings: BatteryReading[],
  n: PortionNutrition
): BatteryReading[] {
  const charges = nutrientCharges(n);
  return readings.map((r) => {
    if (r.batteryTypeId === 'energy') {
      return n.energyKcal > 0 ? chargeEnergy(r, n.energyKcal) : r;
    }
    const charge = charges[r.batteryTypeId];
    return charge && charge > 0 ? applyIntake(r, charge) : r;
  });
}

// The exact inverse of applyFoodToDayReadings, using a logged FoodLogEntry's
// own nutrition snapshot (so reversal is correct even if the food database
// changed since it was logged). Mirrors energyStore.removeFood's reversal,
// again without touching satietyReserveKcal/lastSatietySyncAt. Round-trips
// applyFoodToDayReadings exactly, as long as neither call clamped at the
// battery's floor/ceiling (see spec section 4, invariant 2).
export function reverseFoodOnDayReadings(
  readings: BatteryReading[],
  entry: FoodLogEntry
): BatteryReading[] {
  const charges = nutrientCharges(entry);
  return readings.map((r) => {
    if (r.batteryTypeId === 'energy') {
      return entry.energyKcal > 0 ? burnEnergy(r, entry.energyKcal) : r;
    }
    const amount = charges[r.batteryTypeId];
    return amount && amount > 0 ? applyIntake(r, -amount) : r;
  });
}

// ---------------------------------------------------------------------------
// buildReadingsForMissedDay
// ---------------------------------------------------------------------------

// Builds a fresh reading set for a calendar day the user never opened the app
// on (so no row exists yet in either the nutrients or energy table): nutrient
// batteries sized by `mode` (identical shape to a normal day's reset), and
// the energy reading sized by the profile's safe calorie target (mirrors
// energyStore's applySafeCalorieTarget, minus any activity bonus — a missed
// day has none logged). `calendarDate` and `energyDay` can differ (the 0h-6am
// overlap, spec section 3c): nutrients are always keyed by the calendar day,
// energy always by the energy day. satietyReserveKcal/lastSatietySyncAt are
// intentionally left unset — a backfilled day has no meaningful continuous
// reserve of its own; the caller (S-S4) decides whether/how to carry one over.
export function buildReadingsForMissedDay(
  calendarDate: string,
  energyDay: string,
  profile: UserProfile,
  mode: ModeDefinition
): { nutrients: BatteryReading[]; energy: BatteryReading } {
  const nutrients = DEFAULT_BATTERIES.filter(
    (b) => b.isActive && b.id !== 'master' && b.id !== 'energy'
  ).map((b) => createDailyReading(calendarDate, b.id as BatteryId, mode, 0));

  const energy: BatteryReading = {
    ...createEnergyReading(energyDay, profile),
    capacity: dailyCalorieTarget(profile).targetKcal,
  };

  return { nutrients, energy };
}
