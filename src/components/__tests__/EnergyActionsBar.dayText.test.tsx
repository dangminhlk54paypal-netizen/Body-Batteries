import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { EnergyActionsBar } from '../EnergyActionsBar';
import { FoodLogModal } from '../FoodLogModal';
import { useSettingsStore } from '../../store/settingsStore';

// "⌨️ 🎤 Kể cả ngày" opens the ONE food sheet and goes to the text box only
// once its Modal has been presented (onShow) — presenting it with the text
// box already mounted froze Expo Go (Session 74 → fix in Session 76).
const sheets: { visible: boolean; onShow?: () => void; onClose: () => void }[] = [];
jest.mock('../ui/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return {
    BottomSheet: (props: { visible: boolean; onShow?: () => void; onClose: () => void; children: React.ReactNode }) => {
      sheets.push(props);
      return props.visible ? R.createElement(R.Fragment, null, props.children) : null;
    },
  };
});
jest.mock('../ActivityLogSheet', () => ({ ActivityLogSheet: () => null }));
jest.mock('../PowerliftingSheet', () => ({ PowerliftingSheet: () => null }));
jest.mock('../BodybuildingSheet', () => ({ BodybuildingSheet: () => null }));
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
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('../../data/repositories/foodLogRepository', () => ({
  ...jest.requireActual('../../data/repositories/foodLogRepository'),
  getFoodLogInRange: jest.fn(async () => []),
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

function press(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hits = tree.root.findAll(
    (n) => typeof n.type !== 'string' && typeof n.props.onPress === 'function' && textOf(n).includes(label)
  );
  if (hits.length === 0) throw new Error(`no button "${label}"`);
  const target = hits.reduce((a, b) => (textOf(b).length < textOf(a).length ? b : a));
  return act(async () => {
    await target.props.onPress();
  });
}

// The food sheet's latest props (the only BottomSheet left once the activity
// sheets are mocked away).
const sheet = () => sheets[sheets.length - 1];
const show = () =>
  act(async () => {
    sheet().onShow?.();
  });

let tree: TestRenderer.ReactTestRenderer;
beforeEach(async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'vi' });
  sheets.length = 0;
  await act(async () => {
    tree = TestRenderer.create(<EnergyActionsBar />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

describe('EnergyActionsBar — ⌨️ 🎤 Kể cả ngày', () => {
  it('uses one food sheet and switches to the text box only once it is shown', async () => {
    await press(tree, 'Kể cả ngày');
    expect(sheet().visible).toBe(true);
    expect(textOf(tree.root)).not.toContain('📤 Hỏi AI');
    await show();
    expect(textOf(tree.root)).toContain('📤 Hỏi AI');
    expect(textOf(tree.root)).toContain('Kể cả ngàyⓘ'); // the text box's own title
    // One food sheet for both buttons — never two RN Modals side by side.
    expect(tree.root.findAllByType(FoodLogModal)).toHaveLength(1);
  });

  it('switches only once per open, and never for ⚡ Nạp', async () => {
    await press(tree, 'Kể cả ngày');
    await show();
    await press(tree, 'Quay lại');
    await show(); // e.g. back from "Sửa thành phần"
    expect(textOf(tree.root)).not.toContain('📤 Hỏi AI');

    await act(async () => sheet().onClose());
    await press(tree, '⚡ Nạp');
    await show();
    expect(sheet().visible).toBe(true);
    expect(textOf(tree.root)).not.toContain('📤 Hỏi AI');
  });
});
