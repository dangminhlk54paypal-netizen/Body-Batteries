import { create } from 'zustand';

// Pure UI-signal store (P4): holds no domain data, just an incrementing
// counter that a successful food-log handler bumps to tell MasterBattery
// "play the charging pulse now". Kept fully decoupled from energyStore so
// the animation trigger is an explicit event, never inferred from a
// before/after diff of levelKcal/fillPercentage.
interface ChargeEffectState {
  pulseId: number;
  triggerChargePulse: () => void;
}

export const useChargeEffectStore = create<ChargeEffectState>((set) => ({
  pulseId: 0,
  triggerChargePulse: () => set((s) => ({ pulseId: s.pulseId + 1 })),
}));
