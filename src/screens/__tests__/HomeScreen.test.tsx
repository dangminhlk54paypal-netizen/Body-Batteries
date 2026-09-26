import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { HomeScreen } from '../HomeScreen';
import { useSettingsStore } from '../../store/settingsStore';
import { useEnergyStore } from '../../store/energyStore';
import { useHomeDetailsStore } from '../../store/homeDetailsStore';
import type { FoodLogEntry } from '../../types/food';

// Home keeps text light: the details under the batteries are folded rows of
// "keyword · key number", opening one at a time.
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../services/notifications/notificationService', () => ({ sendLowBatteryAlerts: jest.fn() }));
jest.mock('../../hooks/useLowEnergyWatch', () => ({ useLowEnergyWatch: jest.fn() }));
jest.mock('../../hooks/useMicroBatteryHistory', () => ({
  useMicroBatteryHistory: () => ({ states: [], dates: [], selectedDate: '2026-09-26', setSelectedDate: jest.fn(), entries: [] }),
}));
jest.mock('../../components/LiveMasterBattery', () => ({ LiveMasterBattery: () => null }));
jest.mock('../../components/EnergyActionsBar', () => ({ EnergyActionsBar: () => null }));
jest.mock('../../components/BatteryRing', () => ({ BatteryRing: () => null }));
jest.mock('../../components/IntakeModal', () => ({ IntakeModal: () => null }));
jest.mock('../../components/BatterySourceSheet', () => ({ BatterySourceSheet: () => null }));
jest.mock('../../components/ModeSelector', () => ({ ModeSelector: () => null }));
jest.mock('../../components/TodayMeals', () => ({ TodayMeals: () => 'MEALS_BLOCK' }));
jest.mock('../../components/TodayActivities', () => ({ TodayActivities: () => 'ACTIVITIES_BLOCK' }));
jest.mock('../../components/TodayIntakes', () => ({ TodayIntakes: () => 'INTAKES_BLOCK' }));
jest.mock('../../components/EnergyBalanceCard', () => ({ EnergyBalanceCard: () => 'BALANCE_BLOCK' }));
jest.mock('../../components/MicroBatteryStack', () => ({ MicroBatteryStack: () => 'MICRO_BLOCK' }));
jest.mock('../../components/SupplementQuickLog', () => ({ SupplementQuickLog: () => 'SUPPS_BLOCK' }));

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

const meal: FoodLogEntry = {
  id: 'f1',
  timestamp: 0,
  mealType: 'lunch',
  foodId: 'no-such-food',
  foodNameVi: 'Cơm',
  grams: 200,
  energyKcal: 1450,
  proteinG: 10,
  fatG: 2,
  carbG: 60,
  waterG: 100,
  mineralsMg: 5,
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<HomeScreen />);
  });
  mounted.push(tree);
  return tree;
}

const openRows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => n.props.accessibilityState?.expanded === true && typeof n.props.onPress === 'function')
    .map((n) => n.props.accessibilityLabel as string);

async function tapRow(tree: TestRenderer.ReactTestRenderer, title: string) {
  const row = tree.root.findAll(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(`${title},`) &&
      typeof n.props.onPress === 'function'
  )[0];
  await act(async () => row.props.onPress());
}

beforeEach(async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
  useEnergyStore.setState({
    isLoaded: true,
    readings: [],
    foodLog: [meal],
    activityLog: [],
    intakeLog: [],
    appleHealthBurnedKcal: 1200,
    loadToday: jest.fn(async () => {}),
  });
  useHomeDetailsStore.setState({ mode: 'single', log: [], suggestion: null, snoozedUntil: 0 });
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

describe('HomeScreen details', () => {
  it('starts folded, each row showing a keyword and its key number', async () => {
    const tree = await render();
    expect(openRows(tree)).toEqual([]);
    const text = textOf(tree.root);
    expect(text).toContain('1.450 kcal · 1 món');
    expect(text).toContain('+250 kcal (dư)');
    expect(text).toContain('Chưa ghi');
    expect(text).not.toContain('MEALS_BLOCK');
    // The old always-on paragraphs are gone from the page.
    expect(text).not.toContain('Kéo xuống để làm mới');
  });

  it('opens one row at a time and folds it again on a second tap', async () => {
    const tree = await render();
    await tapRow(tree, 'Đã ăn');
    expect(textOf(tree.root)).toContain('MEALS_BLOCK');
    await tapRow(tree, 'Vận động');
    const text = textOf(tree.root);
    expect(text).toContain('ACTIVITIES_BLOCK');
    expect(text).not.toContain('MEALS_BLOCK');
    await tapRow(tree, 'Vận động');
    expect(openRows(tree)).toEqual([]);
  });

  it('keeps up to three rows open in "view several" mode, folding the oldest', async () => {
    useHomeDetailsStore.setState({ mode: 'multi' });
    const tree = await render();
    for (const title of ['Đã ăn', 'Vận động', 'Cân bằng', 'Vi chất']) await tapRow(tree, title);
    const text = textOf(tree.root);
    expect(text).not.toContain('MEALS_BLOCK');
    expect(text).toContain('ACTIVITIES_BLOCK');
    expect(text).toContain('BALANCE_BLOCK');
    expect(text).toContain('MICRO_BLOCK');
  });

  it('learns from opens, suggests, and switches only when the user agrees', async () => {
    const tree = await render();
    await tapRow(tree, 'Đã ăn');
    expect(useHomeDetailsStore.getState().log).toHaveLength(1);

    await act(async () => useHomeDetailsStore.setState({ suggestion: 'multi' }));
    expect(textOf(tree.root)).toContain('Xem tối đa 3 mục cùng lúc?');
    expect(useHomeDetailsStore.getState().mode).toBe('single');

    const accept = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && textOf(n) === 'Đổi'
    )[0];
    await act(async () => accept.props.onPress());
    expect(useHomeDetailsStore.getState().mode).toBe('multi');
    expect(textOf(tree.root)).not.toContain('Xem tối đa 3 mục cùng lúc?');
  });
});
