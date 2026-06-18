export type ModeId = 'training' | 'maintain' | 'rest';

export interface ModeCapacityOverrides {
  protein?: number;
  carbs?: number;
  water?: number;
  minerals?: number;
  sleep?: number;
  movement?: number;
}

export interface ModeDefinition {
  id: ModeId;
  name: string;
  description: string;
  color: string;
  // How much each battery's default capacity is multiplied
  capacityMultipliers: Record<string, number>;
  // How fast batteries drain per hour (% of capacity)
  drainRatePerHour: number;
}
