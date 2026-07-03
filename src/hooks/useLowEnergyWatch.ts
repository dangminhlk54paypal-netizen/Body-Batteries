import { useEffect, useRef } from 'react';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { sendOvereatingAlert } from '../services/notifications/notificationService';

// S-M: eating past the goal is normal and already shown neutrally on the
// battery itself — this only nudges once the surplus becomes sizeable, not on
// every gram over. 130% = ate ~30% more kcal than today's goal.
const OVEREAT_ALERT_THRESHOLD_PCT = 130;

// Watches the ENERGY battery percentage (eaten / goal, S-M model) and fires a
// single push notification when it crosses UP over the "ăn dư nhiều"
// threshold — e.g. logging a food pushes the day's total well past the goal.
//
// We deliberately do NOT alert on LOW percentage anymore: an empty battery in
// the morning (0% eaten) is completely normal under this model, not
// something to warn about (.ai/CONTEXT.md mục 5 — "không hù pin yếu").
//
// Anti-spam: same "armed" pattern the old low-battery watch used, just
// flipped — armed while at/under the threshold, fires once on the upward
// crossing, then disarms until it drops back to/under the threshold (e.g.
// after removing a food entry, or the next day's reset).
export function useLowEnergyWatch(): void {
  const readings = useEnergyStore((s) => s.readings);
  const masterPercentage = useEnergyStore((s) => s.masterPercentage);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);

  const armedRef = useRef(true);

  useEffect(() => {
    if (!notificationsEnabled) return;

    if (masterPercentage <= OVEREAT_ALERT_THRESHOLD_PCT) {
      // At/under the threshold: re-arm so the next surplus can notify again.
      armedRef.current = true;
      return;
    }

    // Over the threshold here. Only fire on the upward edge (armed -> not armed).
    if (!armedRef.current) return;
    armedRef.current = false;

    const energyReading = readings.find((r) => r.batteryTypeId === 'energy');
    if (!energyReading) return;

    const surplusKcal = Math.round(energyReading.level - energyReading.capacity);
    if (surplusKcal <= 0) return;

    sendOvereatingAlert(
      `Hôm nay đã ăn dư khoảng ${surplusKcal} kcal so với mục tiêu. Chỉ để tham khảo.`
    ).catch((e) => console.warn('useLowEnergyWatch: sendOvereatingAlert failed', e));
  }, [masterPercentage, notificationsEnabled, readings]);
}
