import React from 'react';
import { ScrollView } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { TrainingLogPeriodSection } from '../TrainingLogPeriodSection';
import type { TrainingLogActions } from '../trainingLogActions';
import { useSettingsStore } from '../../../store/settingsStore';
import { getWeightsInRange } from '../../../data/repositories/healthSignalsRepository';
import { getActivityLogInRange } from '../../../data/repositories/activityLogRepository';
import {
  getTrainingLogDaysInRange,
  getTrainingLogWeeksInRange,
} from '../../../data/repositories/trainingLogRepository';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogPeriod } from '../../../types/trainingLog';

// An open month/block scrolls inside its own window, and every period but the
// newest closes itself after two minutes without a touch.
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../data/repositories/activityLogRepository');
jest.mock('../../../data/repositories/healthSignalsRepository');
jest.mock('../../../data/repositories/trainingBlockRepository');
jest.mock('../../../data/repositories/trainingLogRepository');

const period: TrainingLogPeriod = {
  key: 'free:2026-08',
  kind: 'free',
  monthKey: '2026-08',
  startDate: '2026-08-03',
  endDate: '2026-08-09',
  sessions: 0,
  weeks: [{ weekStart: '2026-08-03', weekEnd: '2026-08-09', sessions: 0, dates: [] }],
};

const actions: TrainingLogActions = {
  editDay: jest.fn(),
  addDay: jest.fn(),
  editWeekNote: jest.fn(),
  periodMenu: jest.fn(),
  openPage: jest.fn(),
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

// Async act: the open sections load their data in promises.
async function render(isLatest: boolean) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <TrainingLogPeriodSection period={period} format={DEFAULT_TRAINING_LOG_FORMAT} isLatest={isLatest} actions={actions} />
    );
  });
  mounted.push(tree);
  return tree;
}

const isOpen = (tree: TestRenderer.ReactTestRenderer) => tree.root.findAllByType(ScrollView).length > 0;

async function toggle(tree: TestRenderer.ReactTestRenderer) {
  const header = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityState?.expanded !== undefined
  )[0];
  await act(async () => header.props.onPress());
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(getWeightsInRange).mockResolvedValue([]);
  jest.mocked(getActivityLogInRange).mockResolvedValue([]);
  jest.mocked(getTrainingLogDaysInRange).mockResolvedValue([]);
  jest.mocked(getTrainingLogWeeksInRange).mockResolvedValue([]);
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.useRealTimers();
});

describe('TrainingLogPeriodSection', () => {
  it('shows an open period inside a height-limited scroll window', async () => {
    const tree = await render(true);
    const box = tree.root.findByType(ScrollView);
    expect(box.props.style).toEqual(expect.arrayContaining([{ maxHeight: 320 }]));
  });

  it('an older period closes after 2 minutes untouched; a touch restarts the count', async () => {
    const tree = await render(false);
    expect(isOpen(tree)).toBe(false);
    await toggle(tree);
    expect(isOpen(tree)).toBe(true);

    act(() => jest.advanceTimersByTime(90_000));
    const wrapper = tree.root.findAll((n) => typeof n.props.onTouchStart === 'function')[0];
    act(() => wrapper.props.onTouchStart());
    act(() => jest.advanceTimersByTime(90_000));
    expect(isOpen(tree)).toBe(true); // 3 min open, but touched 1.5 min ago

    act(() => jest.advanceTimersByTime(30_000));
    expect(isOpen(tree)).toBe(false);
  });

  it('the newest period stays open', async () => {
    const tree = await render(true);
    act(() => jest.advanceTimersByTime(10 * 60_000));
    expect(isOpen(tree)).toBe(true);
  });
});
