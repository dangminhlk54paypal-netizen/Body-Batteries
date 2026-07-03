import { useEffect, useRef } from 'react';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  sendOvereatingAlert,
  sendEatReminder,
} from '../services/notifications/notificationService';
import { CIRCADIAN_WINDOW } from '../lib/metabolicConstants';
import { energyDayString } from '../lib/dateUtils';

// S-M: eating past the goal is normal and already shown neutrally on the
// battery itself — this only nudges once the surplus becomes sizeable, not on
// every gram over. 130% = ate ~30% more kcal than today's goal.
const OVEREAT_ALERT_THRESHOLD_PCT = 130;

// Watches the energy battery and fires at most two kinds of gentle push
// notifications (both hard rate-limited, both neutral in tone — CONTEXT mục 5):
//
// 1. Overeating nudge (S-M): fires once when the calorie ledger crosses UP
//    over the "ăn dư nhiều" threshold. Armed/disarmed edge detection keeps it
//    from spamming (re-arms when the ledger drops back, e.g. next energy day).
//
// 2. "Nên ăn" nudge (S-Q): fires at most ONCE PER ENERGY DAY when the satiety
//    reserve has drained all the way to 0 (the battery shows its floor %)
//    during waking hours. A low fullness battery is NORMAL — mornings and
//    long meal gaps are supposed to look like this — so the wording is a soft
//    suggestion, never an alarm, and sleeping hours never notify.
export function useLowEnergyWatch(): void {
  const readings = useEnergyStore((s) => s.readings);
  const masterPercentage = useEnergyStore((s) => s.masterPercentage);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);

  const overeatArmedRef = useRef(true);
  const eatReminderSentForDayRef = useRef<string | null>(null);

  // (1) Overeating nudge — unchanged from S-M.
  useEffect(() => {
    if (!notificationsEnabled) return;

    if (masterPercentage <= OVEREAT_ALERT_THRESHOLD_PCT) {
      // At/under the threshold: re-arm so the next surplus can notify again.
      overeatArmedRef.current = true;
      return;
    }

    // Over the threshold here. Only fire on the upward edge (armed -> not armed).
    if (!overeatArmedRef.current) return;
    overeatArmedRef.current = false;

    const energyReading = readings.find((r) => r.batteryTypeId === 'energy');
    if (!energyReading) return;

    const surplusKcal = Math.round(energyReading.level - energyReading.capacity);
    if (surplusKcal <= 0) return;

    sendOvereatingAlert(
      `Hôm nay đã ăn dư khoảng ${surplusKcal} kcal so với mục tiêu. Chỉ để tham khảo.`
    ).catch((e) => console.warn('useLowEnergyWatch: sendOvereatingAlert failed', e));
  }, [masterPercentage, notificationsEnabled, readings]);

  // (2) Satiety-floor nudge — re-evaluated whenever the store updates the
  // reserve (every ~20-minute tick, on foreground, after meals/workouts).
  useEffect(() => {
    if (!notificationsEnabled) return;

    const energyReading = readings.find((r) => r.batteryTypeId === 'energy');
    if (!energyReading || energyReading.satietyReserveKcal === undefined) return;
    if (energyReading.satietyReserveKcal > 0) return;

    // Only during waking hours — waking up "hungry" at 3am is not a nudge.
    const hour = new Date().getHours();
    if (hour < CIRCADIAN_WINDOW.wakeHour || hour >= CIRCADIAN_WINDOW.sleepHour) return;

    const day = energyDayString();
    if (eatReminderSentForDayRef.current === day) return;
    eatReminderSentForDayRef.current = day;

    sendEatReminder(
      'Bụng có vẻ đói một lúc rồi — nên ăn chút gì nhé. Chỉ để tham khảo.'
    ).catch((e) => console.warn('useLowEnergyWatch: sendEatReminder failed', e));
  }, [notificationsEnabled, readings]);
}
