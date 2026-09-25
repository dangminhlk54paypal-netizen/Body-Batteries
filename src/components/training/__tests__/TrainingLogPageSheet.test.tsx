import React from 'react';
import { Share } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { TrainingLogPageSheet } from '../TrainingLogPageSheet';
import { useSettingsStore } from '../../../store/settingsStore';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogPeriod } from '../../../types/trainingLog';
import type { ActivityLogEntry } from '../../../types/energy';
import * as activityLogRepository from '../../../data/repositories/activityLogRepository';
import * as healthSignalsRepository from '../../../data/repositories/healthSignalsRepository';
import * as trainingLogRepository from '../../../data/repositories/trainingLogRepository';

jest.mock('../../ui/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { BottomSheet: ({ children }: { children: React.ReactNode }) => R.createElement(R.Fragment, null, children) };
});
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
  key: 'month:2026-08',
  monthKey: '2026-08',
  blocks: [],
  startDate: '2026-08-24',
  endDate: '2026-08-30',
  sessions: 1,
  weeks: [{ weekStart: '2026-08-24', weekEnd: '2026-08-30', sessions: 1, dates: ['2026-08-26'] }],
};

const entry: ActivityLogEntry = {
  id: 'a',
  timestamp: new Date(2026, 7, 26, 18).getTime(),
  steps: 0,
  workouts: [{ type: 'deadlift', minutes: 30, sets: [{ kind: 'working', weightKg: 120, reps: 5 }] }],
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-08-26',
};

const mounted: TestRenderer.ReactTestRenderer[] = [];
function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
  jest.mocked(activityLogRepository.getActivityLogInRange).mockResolvedValue([entry]);
  jest.mocked(trainingLogRepository.getTrainingLogDaysInRange).mockResolvedValue([]);
  jest.mocked(trainingLogRepository.getTrainingLogWeeksInRange).mockResolvedValue([]);
  jest.mocked(healthSignalsRepository.getWeightsInRange).mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <TrainingLogPageSheet visible onClose={() => undefined} period={period} format={DEFAULT_TRAINING_LOG_FORMAT} />
    );
  });
  mounted.push(tree);
  return tree;
}

describe('TrainingLogPageSheet', () => {
  it('loads the period and shows it as one page of Notes-style text', async () => {
    const tree = await render();
    const text = textOf(tree.root);
    expect(text).toContain('26.08: D 5x120');
    expect(text).toContain('24.08–30.08');
    expect(activityLogRepository.getActivityLogInRange).toHaveBeenCalledWith('2026-08-24', '2026-08-30');
  });

  it('Share hands exactly the shown text to the OS share sheet', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const tree = await render();
    const shareBtn = tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === 'Chia sẻ')[0];
    await act(async () => {
      shareBtn.props.onPress();
    });
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const message = shareSpy.mock.calls[0][0].message ?? '';
    expect(message).toContain('26.08: D 5x120');
    expect(message.split('\n')[0]).toBe('Tháng 8 năm 2026');
    shareSpy.mockRestore();
  });
});
