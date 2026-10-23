import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BlockBuilderWizard } from '../BlockBuilderWizard';
import { useSettingsStore } from '../../store/settingsStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { listLiftMaxes } from '../../data/repositories/liftMaxRepository';
import { addTrainingBlock, listTrainingBlocks } from '../../data/repositories/trainingBlockRepository';
import { generateBlockPlan } from '../../domain/energy/blockEngine';
import type { TrainingBlockConfig } from '../../types/powerliftingBlock';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../types/energy';

// "Tạo tự động": the wizard reads the last weeks of training, fills its steps
// and lands on the summary, where everything can still be changed.
jest.mock('../ui/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { BottomSheet: ({ children }: { children: React.ReactNode }) => R.createElement(R.Fragment, null, children) };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('../../data/repositories/activityLogRepository');
jest.mock('../../data/repositories/liftMaxRepository');
jest.mock('../../data/repositories/trainingBlockRepository');

const sets = (weightKg: number, reps: number): LiftingSet[] =>
  [1, 2, 3].map(() => ({ kind: 'working' as const, weightKg, reps }));
function session(y: number, m: number, d: number, workouts: Partial<WorkoutSession>[]): ActivityLogEntry {
  return {
    id: `${m}-${d}`,
    timestamp: new Date(y, m - 1, d, 18).getTime(),
    steps: 0,
    energyKcal: 200,
    satietyDrainKcal: 0,
    energyDayApplied: '',
    workouts: workouts.map((w) => ({ minutes: 40, ...w }) as WorkoutSession),
  };
}
// Mondays (bench) and Thursdays (squat) for three weeks.
const history = [5, 12, 19].flatMap((d) => [
  session(2026, 10, d, [{ type: 'bench_press', sets: sets(100, 3) }]),
  session(2026, 10, d + 3, [{ type: 'squat', sets: sets(140, 3) }]),
]);

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
  jest.mocked(listTrainingBlocks).mockResolvedValue([]);
  jest.mocked(listLiftMaxes).mockResolvedValue([]);
});

it('fills the block from the training history and lands on the summary', async () => {
  jest.mocked(getActivityLogInRange).mockResolvedValue(history);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BlockBuilderWizard visible onClose={() => undefined} />);
  });
  const auto = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && textOf(n).includes('✨ Tạo tự động từ lịch sử tập')
  )[0];
  expect(textOf(auto)).toContain('Đọc 6 buổi trong 3 tuần');
  await act(async () => auto.props.onPress());

  const text = textOf(tree.root);
  expect(text).toContain('✨ Điền tự động từ 6 buổi (3 tuần)');
  expect(text).toContain('2 buổi tập/tuần');
  expect(text).toMatch(/1RM: .*152,5 kg.*110 kg.*ước tính an toàn/);
  await act(async () => tree.unmount());
});

it('offers nothing to fill without lifting history', async () => {
  jest.mocked(getActivityLogInRange).mockResolvedValue([]);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BlockBuilderWizard visible onClose={() => undefined} />);
  });
  expect(textOf(tree.root)).not.toContain('✨ Tạo tự động');
  await act(async () => tree.unmount());
});

async function pressText(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hit = tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === label)[0];
  if (!hit) throw new Error(`no pressable "${label}"`);
  await act(async () => hit.props.onPress());
}

it('"Tịnh tiến": the user sets up the linear frame and the block is created with it', async () => {
  jest.mocked(getActivityLogInRange).mockResolvedValue(history);
  jest.mocked(addTrainingBlock).mockResolvedValue(undefined);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BlockBuilderWizard visible onClose={() => undefined} />);
  });
  const auto = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && textOf(n).includes('✨ Tạo tự động từ lịch sử tập')
  )[0];
  await act(async () => auto.props.onPress()); // summary
  await pressText(tree, 'Quay lại'); // deficit
  await pressText(tree, 'Quay lại'); // schedule
  await pressText(tree, 'Quay lại'); // focus
  const linearCard = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && textOf(n).startsWith('Tịnh tiến')
  )[0];
  await act(async () => linearCard.props.onPress());
  expect(textOf(tree.root)).toContain('Khung tịnh tiến');
  await pressText(tree, '＋1 set mọi tuần');
  await pressText(tree, 'Tiếp theo'); // schedule
  await pressText(tree, 'Tiếp theo'); // Training Max — one row per lift, blank = 90% of its 1RM
  expect(textOf(tree.root)).toContain('Training Max (TM)');
  const tmInput = (lift: string) =>
    tree.root.findAll((n) => typeof n.props.onChangeText === 'function' && n.props.accessibilityLabel === `TM của ${lift} (kg)`)[0];
  expect(tmInput('TnG Bench').props.placeholder).toBe('97.5'); // e1RM 110 × 0.9 = 99 → 97.5
  await act(async () => tmInput('Squat').props.onChangeText('140'));
  await pressText(tree, 'Tiếp theo'); // deficit
  await pressText(tree, 'Tiếp theo'); // summary
  expect(textOf(tree.root)).toContain('Tịnh tiến: W1 70% → W5 90% (+5%/tuần) · 5×5 · 5×4 · 4×4 · 4×3 · Test');
  expect(textOf(tree.root)).toContain('TM: TnG Bench 97,5 · Squat 140');
  await pressText(tree, 'Tạo Block');
  const saved = jest.mocked(addTrainingBlock).mock.calls[0][0];
  expect(saved.config.focus).toBe('linear');
  expect(saved.config.progression?.weeks.map((w) => w.sets)).toEqual([5, 5, 4, 4, 1]);
  expect(saved.weeks[0].days[0].variations[0].reference?.method).toBe('linear');
  expect(saved.config.trainingMax).toEqual({ bench_touch_and_go: 97.5, squat_standard: 140 });
  expect(saved.weeks[0].days[0].variations[0].sets[0].weightKg).toBe(67.5); // 70% of TM 97.5 = 68.25 → 67.5
  await act(async () => tree.unmount());
});

it('the next block can take the last block’s 1RMs +5%', async () => {
  jest.mocked(getActivityLogInRange).mockResolvedValue([]);
  const prevConfig: TrainingBlockConfig = {
    id: 'p',
    createdAt: 1,
    weekStartDate: '2026-09-07',
    progressiveWeeks: 3,
    hasDeload: false,
    focus: 'linear',
    schedule: [{ dayOfWeek: 1, variations: [{ exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' }], accessories: [] }],
    oneRepMax: { squat: 150, bench_press: 100 },
    isBeginnerEstimated: { squat: false, bench_press: false, deadlift: true },
    bodyWeightKg: 80,
    deficitModeEnabled: false,
  };
  const prev = generateBlockPlan(prevConfig, { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' });
  jest.mocked(listTrainingBlocks).mockResolvedValue([prev]);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BlockBuilderWizard visible onClose={() => undefined} />);
  });
  await pressText(tree, 'Tiếp theo'); // profile step
  await pressText(tree, '+5%');
  const values = tree.root
    .findAll((n) => typeof n.props.onChangeText === 'function' && n.props.keyboardType === 'decimal-pad')
    .map((n) => n.props.value);
  expect(values).toEqual(expect.arrayContaining(['157.5', '105']));
  await act(async () => tree.unmount());
});
