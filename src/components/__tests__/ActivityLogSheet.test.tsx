import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ActivityLogSheet } from '../ActivityLogSheet';
import { useSettingsStore } from '../../store/settingsStore';
import { useActivityDraftStore } from '../../store/activityDraftStore';
import { blankDraft, DRAFT_TTL_MS } from '../../domain/energy/activityDraft';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import type { ActivityLogEntry } from '../../types/energy';

// The activity sheet keeps what the user typed (accidental close), drops it on
// Cancel or after 5 minutes, and prefills a fresh form "as usual".
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
jest.mock('../../data/repositories/activityLogRepository', () => ({ getActivityLogInRange: jest.fn() }));
jest.mock('../FoodLogModal', () => ({ buildTimestampForDate: jest.fn(() => 0) }));

const NOW = new Date(2026, 8, 26, 7, 10).getTime(); // Sat 07:10
const TODAY = '2026-09-26';
const DAY = 24 * 60 * 60 * 1000;

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

function run(daysBack: number): ActivityLogEntry {
  const start = new Date(NOW - daysBack * DAY);
  start.setHours(6, 30, 0, 0);
  const s = start.getTime();
  return {
    id: `r${daysBack}`,
    timestamp: s + 30 * 60_000,
    startAt: s,
    endAt: s + 30 * 60_000,
    steps: 0,
    workouts: [{ type: 'running', minutes: 30 }],
    energyKcal: 300,
    satietyDrainKcal: 0,
    energyDayApplied: TODAY,
  };
}

const mounted: TestRenderer.ReactTestRenderer[] = [];
async function render(onClose = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <ActivityLogSheet visible onClose={onClose} onOpenPowerlifting={jest.fn()} onOpenBodybuilding={jest.fn()} />
    );
  });
  mounted.push(tree);
  return tree;
}
const minutesInput = (tree: TestRenderer.ReactTestRenderer) => tree.root.findAllByType(TextInput)[0];

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'vi', customActivities: [] });
  useActivityDraftStore.setState({ draft: null, savedAt: 0 });
  jest.mocked(getActivityLogInRange).mockResolvedValue([]);
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.useRealTimers();
});

describe('ActivityLogSheet', () => {
  it('continues a draft saved less than 5 minutes ago', async () => {
    useActivityDraftStore.setState({ draft: { ...blankDraft(TODAY), minutes: '25' }, savedAt: NOW - 60_000 });
    const tree = await render();
    expect(minutesInput(tree).props.value).toBe('25');
    expect(textOf(tree.root)).toContain('Tiếp tục phần bạn đang nhập dở');
  });

  it('starts fresh when the draft is older than 5 minutes', async () => {
    useActivityDraftStore.setState({
      draft: { ...blankDraft(TODAY), minutes: '25' },
      savedAt: NOW - DRAFT_TTL_MS - 1,
    });
    const tree = await render();
    expect(minutesInput(tree).props.value).toBe('');
  });

  it('keeps every edit on the device, and Cancel discards it and closes', async () => {
    const onClose = jest.fn();
    const tree = await render(onClose);
    await act(async () => minutesInput(tree).props.onChangeText('40'));
    expect(useActivityDraftStore.getState().draft?.minutes).toBe('40');

    const cancel = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && textOf(n) === 'Huỷ'
    )[0];
    await act(async () => cancel.props.onPress());
    expect(useActivityDraftStore.getState().draft).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('prefills a fresh form with the usual activity around this time', async () => {
    jest.mocked(getActivityLogInRange).mockResolvedValue([run(1), run(2), run(3)]);
    const tree = await render();
    expect(minutesInput(tree).props.value).toBe('30');
    expect(textOf(tree.root)).toContain('Như thường lệ');
    expect(textOf(tree.root)).toContain('06:30–07:00');
  });
});
