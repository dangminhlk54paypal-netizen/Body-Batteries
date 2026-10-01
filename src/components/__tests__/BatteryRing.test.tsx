import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BatteryRing } from '../BatteryRing';
import { DEFAULT_BATTERIES } from '../../lib/constants';
import type { BatteryState } from '../../types/battery';
import type { MicroBatteryState } from '../../types/nutrition';
import type { RingMetricId } from '../../domain/battery/ringMetrics';

// The Home ring: centre count over every chosen metric, and past 3
// micronutrients a small corner ring that swaps with the big one on tap.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const batteries: BatteryState[] = DEFAULT_BATTERIES.map((type) => ({ type, level: 0, capacity: 100, percentage: 0 }));
const micro = (id: MicroBatteryState['id'], kind: MicroBatteryState['kind']): MicroBatteryState => ({
  id,
  kind,
  nameVi: id,
  unit: 'g',
  color: '#123456',
  current: 1,
  target: 10,
  percentage: 10,
  over: false,
});
const microStates = [micro('fat', 'goal'), micro('sugar', 'limit'), micro('fiber', 'goal'), micro('salt', 'limit'), micro('iron', 'goal')];

function render(metricIds: RingMetricId[]) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <BatteryRing batteries={batteries} metricIds={metricIds} microStates={microStates} foodLog={[]} activityLog={[]} intakeLog={[]} />
    );
  });
  return r;
}

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.props.children === 'string' || typeof n.props.children === 'number').map((n) => String(n.props.children));

describe('BatteryRing', () => {
  it('5 sub-batteries + sugar → the centre counts 6, not 5', () => {
    const r = render(['protein', 'carbs', 'water', 'sleep', 'movement', 'sugar']);
    expect(texts(r)).toContain('0/6');
  });

  it('4+ micronutrients: a small corner ring; tapping it brings them to the big ring', () => {
    const r = render(['protein', 'carbs', 'fat', 'sugar', 'fiber', 'salt', 'iron']);
    const legendBefore = r.root.findAllByType(Text).filter((n) => n.props.children === 'Protein');
    expect(legendBefore.length).toBeGreaterThan(0);
    expect(texts(r)).toContain('0/2'); // big ring: protein + carbs
    expect(texts(r)).toContain('0/5'); // small ring: 5 micronutrients
    expect(texts(r).some((x) => x.includes('⇄'))).toBe(true);
    const mini = r.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.includes('0/5')
    )[0];
    act(() => mini.props.onPress());
    // Legend now lists the micronutrients; protein moved to the small ring.
    expect(r.root.findAllByType(Text).some((n) => n.props.children === 'Protein')).toBe(false);
  });

  it('≤ 3 micronutrients: one ring only', () => {
    const r = render(['protein', 'carbs', 'fat', 'sugar']);
    expect(texts(r)).toContain('0/4');
    expect(texts(r).some((x) => x.includes('⇄'))).toBe(false);
  });
});
