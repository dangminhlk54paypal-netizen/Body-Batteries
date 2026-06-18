import { useEffect, useRef } from 'react';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { checkLowBattery } from '../domain/rules/lowBatteryRules';
import { sendLowBatteryAlerts } from '../services/notifications/notificationService';

// Watches the ENERGY battery percentage (Hướng B master battery) and fires a
// single push notification when it drains DOWN across the user's low-battery
// threshold (e.g. while time passes via tickDrain, with no new intake to
// trigger the existing addIntake-based alert).
//
// Anti-spam: we track whether we are currently "armed" (i.e. the last known
// state was >= threshold) in a ref. We only send a notification on the exact
// downward crossing (armed && newPct < threshold), then disarm so we don't
// fire again every render/tick while the battery stays low. We only re-arm
// once the percentage recovers back to >= threshold.
export function useLowEnergyWatch(): void {
  const readings = useEnergyStore((s) => s.readings);
  const masterPercentage = useEnergyStore((s) => s.masterPercentage);
  const lowBatteryThreshold = useSettingsStore((s) => s.lowBatteryThreshold);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);

  // true = currently above-or-at threshold and eligible to fire the next time
  // we cross below it; false = already fired for the current low period.
  const armedRef = useRef(true);

  useEffect(() => {
    if (!notificationsEnabled) return;

    const pct = masterPercentage / 100;

    if (pct >= lowBatteryThreshold) {
      // Back above threshold: re-arm so the next dip can notify again.
      armedRef.current = true;
      return;
    }

    // pct < threshold here. Only fire on the downward edge (armed -> not armed).
    if (!armedRef.current) return;
    armedRef.current = false;

    const energyReading = readings.find((r) => r.batteryTypeId === 'energy');
    if (!energyReading) return;

    const alerts = checkLowBattery([energyReading], lowBatteryThreshold);
    if (alerts.length === 0) return;

    sendLowBatteryAlerts(alerts).catch((e) =>
      console.warn('useLowEnergyWatch: sendLowBatteryAlerts failed', e)
    );
  }, [masterPercentage, lowBatteryThreshold, notificationsEnabled, readings]);
}
