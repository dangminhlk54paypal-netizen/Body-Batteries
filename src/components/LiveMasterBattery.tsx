import React from 'react';
import { MasterBattery } from './MasterBattery';
import { useLiveEnergyReading } from '../hooks/useLiveEnergyReading';

// Wraps MasterBattery with a per-second live display of the energy battery,
// without forcing the rest of HomeScreen to re-render every second.
export function LiveMasterBattery() {
  const { percentage, levelKcal, capacityKcal } = useLiveEnergyReading();
  return <MasterBattery percentage={percentage} levelKcal={levelKcal} capacityKcal={capacityKcal} />;
}
