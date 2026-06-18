import type { ModeDefinition } from '../../types/modes';

export const MODES: Record<string, ModeDefinition> = {
  training: {
    id: 'training',
    name: 'Tập luyện',
    description: 'Nhu cầu dinh dưỡng cao hơn, pin xả nhanh hơn',
    color: '#FF6B6B',
    capacityMultipliers: {
      protein: 1.5,
      carbs: 1.3,
      water: 1.4,
      minerals: 1.2,
      sleep: 1.0,
      movement: 1.5,
    },
    drainRatePerHour: 0.05, // 5% per hour
  },
  maintain: {
    id: 'maintain',
    name: 'Duy trì',
    description: 'Mức năng lượng bình thường mỗi ngày',
    color: '#00B894',
    capacityMultipliers: {
      protein: 1.0,
      carbs: 1.0,
      water: 1.0,
      minerals: 1.0,
      sleep: 1.0,
      movement: 1.0,
    },
    drainRatePerHour: 0.03, // 3% per hour
  },
  rest: {
    id: 'rest',
    name: 'Nghỉ ngơi',
    description: 'Phục hồi — nhu cầu thấp hơn, pin bền hơn',
    color: '#6C5CE7',
    capacityMultipliers: {
      protein: 0.8,
      carbs: 0.8,
      water: 0.9,
      minerals: 0.9,
      sleep: 1.2,
      movement: 0.5,
    },
    drainRatePerHour: 0.015, // 1.5% per hour
  },
};

export function getModeById(id: string): ModeDefinition {
  return MODES[id] ?? MODES['maintain'];
}
