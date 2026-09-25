import React from 'react';
import { Switch } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SettingsScreen } from '../SettingsScreen';
import { useSettingsStore } from '../../store/settingsStore';

// Settings is a short list of folded cards: each shows its current values in
// one line, and only one opens at a time.
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../services/notifications/notificationService', () => ({
  requestNotificationPermission: jest.fn(),
  scheduleDailyReminder: jest.fn(),
  cancelAllNotifications: jest.fn(),
}));
jest.mock('../../services/export/excelExportService', () => ({ exportWeeklyData: jest.fn(), exportMonthlyData: jest.fn() }));
jest.mock('../../services/cleanup/cleanupService', () => ({ runWeeklyCleanup: jest.fn() }));
jest.mock('../../components/food/MyFoodsSheet', () => ({ MyFoodsSheet: () => null }));
jest.mock('../../components/BodyProfileCard', () => ({ BodyProfileCard: () => null }));

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<SettingsScreen />);
  });
  mounted.push(tree);
  return tree;
}

const openCards = (tree: TestRenderer.ReactTestRenderer) =>
  new Set(
    tree.root
      .findAll((n) => n.props.accessibilityState?.expanded === true && typeof n.props.onPress === 'function')
      .map((n) => n.props.accessibilityLabel)
  );

async function tap(tree: TestRenderer.ReactTestRenderer, label: string) {
  const header = tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  await act(async () => header.props.onPress());
}

const mounted: TestRenderer.ReactTestRenderer[] = [];

beforeEach(async () => {
  // Let the persisted store finish loading first, so it doesn't update mid-test.
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({
    language: 'vi',
    themeMode: 'dark',
    notificationsEnabled: true,
    reminderHour: 20,
    reminderMinute: 0,
    lowBatteryThreshold: 0.2,
  });
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

describe('SettingsScreen', () => {
  it('starts with every card folded, each showing its values in one line', async () => {
    const tree = await render();
    expect(openCards(tree).size).toBe(0);
    expect(tree.root.findAllByType(Switch)).toHaveLength(0);
    const text = textOf(tree.root);
    expect(text).toContain('Nhắc 20:00 · báo pin < 20%');
    expect(text).toContain('Tiếng Việt · tự dịch món: tắt');
  });

  it('opens one card at a time', async () => {
    const tree = await render();
    await tap(tree, 'THÔNG BÁO');
    expect([...openCards(tree)]).toEqual(['THÔNG BÁO']);
    expect(textOf(tree.root)).toContain('Báo khi pin dưới');
    await tap(tree, 'GIAO DIỆN');
    expect([...openCards(tree)]).toEqual(['GIAO DIỆN']);
    await tap(tree, 'GIAO DIỆN');
    expect(openCards(tree).size).toBe(0);
  });

  it('the reminder minutes move in quarter hours', async () => {
    const tree = await render();
    await tap(tree, 'THÔNG BÁO');
    const plus = tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === '+');
    await act(async () => plus[1].props.onPress()); // [0] = hour, [1] = minute
    expect(useSettingsStore.getState().reminderMinute).toBe(15);
  });
});
