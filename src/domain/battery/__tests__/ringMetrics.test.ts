import {
  DEFAULT_RING_METRICS,
  RING_MICRO_IDS,
  buildRingItems,
  isDefaultRingMetrics,
  resolveRingMetrics,
  ringLegendColumns,
  ringReached,
  splitRing,
  toggleRingMetric,
} from '../ringMetrics';
import type { RingMetricId } from '../ringMetrics';
import { DEFAULT_BATTERIES } from '../../../lib/constants';
import type { BatteryState } from '../../../types/battery';
import type { MicroBatteryState } from '../../../types/nutrition';
import type { DailyBatteryTotals } from '../dailyBatteryTotals';

const batteries: BatteryState[] = DEFAULT_BATTERIES.map((type) => ({
  type,
  level: 0,
  capacity: type.id === 'protein' ? 100 : type.id === 'carbs' ? 200 : 1000,
  percentage: 0,
}));
const totals: DailyBatteryTotals = {
  protein: 120,
  carbs: 100,
  minerals: 0,
  water: 0,
  sleep: 0,
  movementSteps: 0,
  movementKcal: 0,
};
const micro = (id: MicroBatteryState['id'], kind: MicroBatteryState['kind'], current: number, target: number, color: string): MicroBatteryState => ({
  id,
  kind,
  nameVi: id,
  unit: 'g',
  color,
  current,
  target,
  percentage: Math.round((current / target) * 100),
  over: current > target,
});
const microStates = [micro('fat', 'goal', 39, 78, '#FFD93D'), micro('sugar', 'limit', 75, 50, '#FD79A8')];

describe('resolveRingMetrics', () => {
  it('no saved choice → the 6 sub-batteries', () => {
    expect(resolveRingMetrics(null)).toEqual(DEFAULT_RING_METRICS);
    expect(DEFAULT_RING_METRICS).toHaveLength(6);
  });

  it('keeps canonical order, drops unknown ids and duplicates, falls back below 2', () => {
    expect(resolveRingMetrics(['sugar', 'protein', 'bogus', 'fat', 'carbs', 'protein'])).toEqual([
      'protein',
      'carbs',
      'fat',
      'sugar',
    ]);
    expect(resolveRingMetrics(['protein'])).toEqual(DEFAULT_RING_METRICS);
  });
});

describe('toggleRingMetric', () => {
  it('adds in canonical order and removes, never below 2, no upper bound', () => {
    const four: RingMetricId[] = ['protein', 'carbs', 'fat', 'sugar'];
    expect(toggleRingMetric(['protein', 'sugar'], 'carbs')).toEqual(['protein', 'carbs', 'sugar']);
    expect(toggleRingMetric(four, 'fat')).toEqual(['protein', 'carbs', 'sugar']);
    expect(toggleRingMetric(['protein', 'carbs'], 'carbs')).toEqual(['protein', 'carbs']); // min 2
    // Salt / sodium / iron can always be added (the old cap of 8 silently refused them).
    const eight: RingMetricId[] = [...DEFAULT_RING_METRICS, 'fat', 'sugar'];
    expect(toggleRingMetric(toggleRingMetric(eight, 'salt'), 'iron')).toEqual([
      ...DEFAULT_RING_METRICS,
      'fat',
      'sugar',
      'salt',
      'iron',
    ]);
    const all: RingMetricId[] = [...DEFAULT_RING_METRICS, ...RING_MICRO_IDS];
    expect(resolveRingMetrics(all)).toEqual(all);
  });

  it('isDefaultRingMetrics', () => {
    expect(isDefaultRingMetrics(DEFAULT_RING_METRICS)).toBe(true);
    expect(isDefaultRingMetrics(['protein', 'carbs'])).toBe(false);
  });
});

describe('buildRingItems', () => {
  it('protein · carbs · fat · sugar: 4 items, ratios against target/cap', () => {
    const items = buildRingItems(['protein', 'carbs', 'fat', 'sugar'], batteries, totals, microStates);
    expect(items.map((i) => [i.id, i.ratio])).toEqual([
      ['protein', 1.2],
      ['carbs', 0.5],
      ['fat', 0.5],
      ['sugar', 1.5],
    ]);
  });

  it('a micronutrient never shares a colour with a sub-battery on the same ring (carbs vs fat)', () => {
    const items = buildRingItems(['protein', 'carbs', 'fat', 'sugar'], batteries, totals, microStates);
    const colors = items.map((i) => i.color.toUpperCase());
    expect(new Set(colors).size).toBe(colors.length);
    expect(items[1].color).toBe('#FFD93D'); // carbs keeps its own yellow
    // Without carbs on the ring, fat keeps its usual colour.
    expect(buildRingItems(['protein', 'fat'], batteries, totals, microStates)[1].color).toBe('#FFD93D');
  });

  it('centre count covers every metric on the ring; a limit is on target while within its cap', () => {
    // 5 sub-batteries (minerals dropped) + sugar → x/6, not x/5.
    const six = buildRingItems(['protein', 'carbs', 'water', 'sleep', 'movement', 'sugar'], batteries, totals, [
      micro('sugar', 'limit', 30, 50, '#FD79A8'),
    ]);
    expect(ringReached(six, true)).toEqual({ done: 2, total: 6 }); // protein 120 % + sugar within cap
    // Nothing eaten yet: an empty sugar total is not "on target".
    expect(ringReached(six, false)).toEqual({ done: 1, total: 6 });
    // Sugar past its cap is not on target.
    const over = buildRingItems(['protein', 'sugar'], batteries, totals, microStates);
    expect(ringReached(over, true)).toEqual({ done: 1, total: 2 });
  });
});

describe('ringLegendColumns', () => {
  it('keeps rows even', () => {
    expect([2, 3, 4, 5, 6, 7, 8].map(ringLegendColumns)).toEqual([2, 3, 2, 3, 3, 3, 4]);
  });
});

describe('splitRing — more than 3 micronutrients get their own small ring', () => {
  const ids: RingMetricId[] = ['protein', 'carbs', 'fat', 'sugar', 'fiber', 'salt'];
  const states = [
    ...microStates,
    micro('fiber', 'goal', 10, 38, '#00B894'),
    micro('salt', 'limit', 2, 5, '#E17055'),
  ];

  it('≤ 3 micronutrients: one ring', () => {
    const items = buildRingItems(['protein', 'carbs', 'fat', 'sugar', 'fiber'], batteries, totals, states);
    expect(splitRing(items).mini).toBeNull();
  });

  it('4 micronutrients: sub-batteries on the big ring, micronutrients on the small one', () => {
    const { main, mini } = splitRing(buildRingItems(ids, batteries, totals, states));
    expect(main.map((i) => i.id)).toEqual(['protein', 'carbs']);
    expect(mini!.map((i) => i.id)).toEqual(['fat', 'sugar', 'fiber', 'salt']);
  });

  it('no sub-battery chosen: everything stays on one ring', () => {
    const { main, mini } = splitRing(buildRingItems(['fat', 'sugar', 'fiber', 'salt'], batteries, totals, states));
    expect(mini).toBeNull();
    expect(main).toHaveLength(4);
  });
});
