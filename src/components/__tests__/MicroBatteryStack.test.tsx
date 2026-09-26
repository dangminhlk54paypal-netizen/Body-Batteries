import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { MicroBatteryStack } from '../MicroBatteryStack';
import { useSettingsStore } from '../../store/settingsStore';
import type { MicroBatteryState } from '../../types/nutrition';

// Micro battery cells form an even row in every language: fixed width, three
// single lines (%, short name, current/target) that shrink rather than wrap.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../MicroBatterySourceSheet', () => ({ MicroBatterySourceSheet: () => null }));
jest.mock('../OverdoseNotice', () => ({ OverdoseNotice: () => null }));

function state(overrides: Partial<MicroBatteryState>): MicroBatteryState {
  return {
    id: 'fiber',
    kind: 'goal',
    nameVi: 'Chất xơ',
    unit: 'g',
    color: '#8BC34A',
    current: 12,
    target: 30,
    percentage: 40,
    over: false,
    ...overrides,
  };
}

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

it('keeps every cell to three single, shrinking lines in German', async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'de' });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <MicroBatteryStack
        states={[
          state({}),
          state({ id: 'omega3', unit: 'mg', current: 250, target: 500, percentage: 50 }),
          state({ id: 'sodium', kind: 'limit', unit: 'mg', current: 2600, target: 2300, percentage: 113, over: true }),
        ]}
        dates={[]}
        selectedDate="2026-09-26"
        onSelectDate={() => {}}
        foodLog={[]}
        embedded
      />
    );
  });
  const text = textOf(tree.root);
  expect(text).toContain('Ballaststoffe');
  expect(text).toContain('Omega-3'); // in the "see more" line, short name too
  expect(text).toContain('12/30g');
  expect(text).not.toContain('(EPA+DHA)'); // full name only in a11y / sheet
  expect(text).not.toContain('Natrium (Salz)');

  const nameLines = tree.root.findAll(
    (n) => n.type === Text && ['Ballaststoffe', 'Natrium'].includes(textOf(n))
  );
  expect(nameLines).toHaveLength(2);
  for (const line of nameLines) {
    expect(line.props.numberOfLines).toBe(1);
    expect(line.props.adjustsFontSizeToFit).toBe(true);
  }
  // The long caption moved into the screen-reader label.
  const sodium = tree.root.findAll(
    (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Natrium (Salz)')
  )[0];
  expect(sodium.props.accessibilityLabel).toContain('·');
  await act(async () => tree.unmount());
});
