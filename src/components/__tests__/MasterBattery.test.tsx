import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MasterBattery } from '../MasterBattery';
import { useSettingsStore } from '../../store/settingsStore';

// Under the big battery: one number line + keyword chips on screen; the full
// sentences (ledger, goal, BMR target, disclaimer) only inside ⓘ.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock')
);

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

beforeEach(async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'vi', particleEffectsEnabled: false });
});

it('shows numbers and chips, keeps the sentences behind ⓘ', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <MasterBattery
        satietyPct={60}
        levelKcal={2150}
        capacityKcal={2000}
        activityBonusKcal={300}
        goalLabel="Mục tiêu: giảm về 72 kg (an toàn)"
        goalChip="🎯 ↓ 72 kg"
        targetLine="Cần ~1.800 kcal/ngày để đạt 72 kg · BMR ~1.500"
      />
    );
  });
  const text = textOf(tree.root);
  expect(text).toContain('2.150 / 2.000 kcal');
  expect(text).toContain('+150 dư');
  expect(text).toContain('🏃 +300');
  expect(text).toContain('🎯 ↓ 72 kg');
  expect(text).not.toContain('Sổ calo hôm nay');
  expect(text).not.toContain('BMR');
  expect(text).not.toContain('Chỉ để tham khảo');
  await act(async () => tree.unmount());
});
