import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BlockVariationEditSheet } from '../BlockVariationEditSheet';
import { BlockWeekDatesSheet } from '../BlockWeekDatesSheet';
import { BlockPlanView } from '../BlockPlanView';
import { useSettingsStore } from '../../../store/settingsStore';
import { useBlockStore } from '../../../store/blockStore';
import { generateBlockPlan } from '../../../domain/energy/blockEngine';
import { referenceOf, setVariationSets } from '../../../domain/energy/blockPlanEdits';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { UserProfile } from '../../../types/energy';
import type { GeneratedBlockPlan, TrainingBlockConfig } from '../../../types/powerliftingBlock';
import * as trainingBlockRepository from '../../../data/repositories/trainingBlockRepository';
import { getActivityLogInRange } from '../../../data/repositories/activityLogRepository';
import { useEnergyStore } from '../../../store/energyStore';
import { usePlanFoldStore } from '../../../store/planFoldStore';

// Render-level tests for editing a block plan in the app (feedback 2026-09-24):
// the user's own sets in their Notes shorthand, real week dates that move the
// later weeks, and the app's suggestion + arithmetic kept beside the plan.
jest.mock('../../ui/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { BottomSheet: ({ children }: { children: React.ReactNode }) => R.createElement(R.Fragment, null, children) };
});
// CollapsibleSection animates with reanimated (native-only); a plain open
// section is enough to read what the weeks contain.
jest.mock('../../ui/CollapsibleSection', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, R.createElement(Text, null, title), children),
  };
});
jest.mock('../../BlockBuilderWizard', () => ({ BlockBuilderWizard: () => null }));
jest.mock('@react-navigation/native', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../data/repositories/trainingBlockRepository');
jest.mock('../../../data/repositories/activityLogRepository');
jest.mock('../../../services/export/trainingBlockExportService', () => ({ exportTrainingBlockToExcel: jest.fn() }));

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };
const config: TrainingBlockConfig = {
  id: 'b',
  createdAt: 1,
  weekStartDate: '2026-09-07',
  progressiveWeeks: 2,
  hasDeload: true,
  focus: 'volume',
  schedule: [
    {
      dayOfWeek: 1,
      variations: [{ exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' }],
      accessories: [],
    },
  ],
  oneRepMax: { squat: 200, bench_press: 120, deadlift: 250 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
};
const plan = (): GeneratedBlockPlan => generateBlockPlan(config, profile);

const mounted: TestRenderer.ReactTestRenderer[] = [];
async function mount(el: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(el);
  });
  mounted.push(tree);
  return tree;
}
function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}
function input(tree: TestRenderer.ReactTestRenderer, label: string) {
  return tree.root.findAll((n) => typeof n.props.onChangeText === 'function' && n.props.accessibilityLabel === label)[0];
}
function pressable(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hit = tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes(label))[0];
  if (!hit) throw new Error(`no pressable "${label}"`);
  return hit;
}
async function press(tree: TestRenderer.ReactTestRenderer, label: string) {
  await act(async () => {
    pressable(tree, label).props.onPress();
  });
}
async function type(tree: TestRenderer.ReactTestRenderer, label: string, text: string) {
  await act(async () => {
    input(tree, label).props.onChangeText(text);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    language: 'vi',
    themeMode: 'dark',
    trainingLogFormat: DEFAULT_TRAINING_LOG_FORMAT,
    userProfile: profile,
  });
});
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

describe('BlockVariationEditSheet', () => {
  const p = plan();
  const v = p.weeks[1].days[0].variations[0];
  const render = (onSave = jest.fn(), onRestore = jest.fn(), variation = v) =>
    mount(
      <BlockVariationEditSheet
        visible
        onClose={() => undefined}
        title="Bench · Tuần 2"
        variation={variation}
        reference={referenceOf(p, variation)}
        bodyWeightKg={80}
        heightCm={175}
        onSave={onSave}
        onRestore={onRestore}
      />
    );

  it('starts with the current plan written in the Notes shorthand', async () => {
    const tree = await render();
    // A main lift's plan opens with its prime: "92.5 + 4x5x75".
    expect(input(tree, 'Kế hoạch của bạn').props.value).toMatch(/^[\d.]+ \+ \d+x\d+x[\d.]+$/);
  });

  it('reads "110x1 5x5x95" as 6 sets, previews them, and saves exactly those sets', async () => {
    const onSave = jest.fn();
    const tree = await render(onSave);
    await type(tree, 'Kế hoạch của bạn', '110x1 5x5x95');
    const text = textOf(tree.root);
    expect(text).toContain('App hiểu là 6 set:');
    expect(text).toContain('110 kg × 1');
    await press(tree, 'Lưu');
    expect(onSave).toHaveBeenCalledWith([
      { kind: 'working', weightKg: 110, reps: 1 },
      ...Array.from({ length: 5 }, () => ({ kind: 'working', weightKg: 95, reps: 5 })),
    ]);
  });

  it('names the part it cannot read and keeps Save disabled', async () => {
    const tree = await render();
    await type(tree, 'Kế hoạch của bạn', '5x5x95 abc');
    expect(textOf(tree.root)).toContain('Không hiểu "abc"');
    expect(pressable(tree, 'Lưu').props.disabled).toBe(true);
  });

  it('“restore the app suggestion” only appears once edited, and calls onRestore', async () => {
    expect(textOf((await render()).root)).not.toContain('Khôi phục gợi ý');
    const edited = setVariationSets(p, { weekIndex: 1, dayIndex: 0, variationIndex: 0 }, [{ kind: 'working', weightKg: 90, reps: 5 }], 175)
      .weeks[1].days[0].variations[0];
    const onRestore = jest.fn();
    const tree = await render(jest.fn(), onRestore, edited);
    await press(tree, 'Khôi phục gợi ý của app');
    expect(onRestore).toHaveBeenCalled();
  });
});

describe('BlockWeekDatesSheet', () => {
  it('shows where the later weeks land and saves the typed dates', async () => {
    const onSave = jest.fn().mockResolvedValue(null);
    const tree = await mount(
      <BlockWeekDatesSheet
        visible
        onClose={() => undefined}
        plan={plan()}
        weekIndex={1}
        weekLabel={(i) => (i === 2 ? 'Deload' : `Tuần ${i + 1}`)}
        onSave={onSave}
      />
    );
    expect(input(tree, 'Từ ngày').props.value).toBe('14.09');
    await type(tree, 'Từ ngày', '21.09');
    await type(tree, 'Đến ngày', '27.09');
    expect(textOf(tree.root)).toContain('Deload: ');
    expect(textOf(tree.root)).toContain('28/09'); // deload now starts Mon 28.09 (vi-VN display)
    await press(tree, 'Lưu');
    expect(onSave).toHaveBeenCalledWith('2026-09-21', '2026-09-27');
  });

  it('refuses a week that overlaps the previous one', async () => {
    const tree = await mount(
      <BlockWeekDatesSheet visible onClose={() => undefined} plan={plan()} weekIndex={1} weekLabel={() => 'x'} onSave={jest.fn()} />
    );
    await type(tree, 'Từ ngày', '12.09');
    expect(textOf(tree.root)).toContain('phải bắt đầu sau');
    expect(pressable(tree, 'Lưu').props.disabled).toBe(true);
  });
});

describe('BlockPlanView', () => {
  // Pin "today" inside week 1 (Date only — promises and timers stay real).
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-08T10:00:00'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
    jest.mocked(trainingBlockRepository.listTrainingBlocks).mockResolvedValue([]);
    jest.mocked(trainingBlockRepository.updateTrainingBlock).mockResolvedValue(undefined);
    jest.mocked(getActivityLogInRange).mockResolvedValue([]);
    usePlanFoldStore.setState({ key: null, weeks: {} });
    useBlockStore.setState({ activeBlock: null, blocks: [] });
  });
  afterEach(() => jest.useRealTimers());

  it('titles weeks "B1W1" only and lists each session as table rows', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    const text = textOf(tree.root);
    expect(text).toContain('B1W1');
    expect(text).toContain('B1W2');
    expect(text).toContain('B1 DELOAD');
    expect(text).toMatch(/07\/09/); // week 1's Monday heads its session
    expect(text).not.toContain('Kế hoạch: ');
    expect(text).not.toContain('công thức cũ');
    expect(text).not.toContain('Gợi ý của app:');
    expect(text).not.toContain('EPOC');
  });

  it('opens the ⓘ popup with the rationale, the suggestion with its RPE, and the math', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    const badge = tree.root.findAll(
      (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Giải thích: Bench chạm ngực-đẩy liên tục (Touch-and-go)'
    )[0];
    expect(badge).toBeDefined();
    await act(async () => {
      badge.props.onPress();
    });
    const text = textOf(tree.root);
    expect(text).toContain('Gợi ý của app:');
    expect(text).toContain('RPE 6.5 ở set cuối');
    expect(text).toContain('Cách app tính');
  });

  it('puts the EPOC note behind the title ⓘ', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await act(async () => {
      tree.root.findAll((n) => typeof n.props.onPress === 'function' && /^Giải thích: /.test(n.props.accessibilityLabel ?? ''))[0].props.onPress();
    });
    expect(textOf(tree.root)).toContain('EPOC');
  });

  it('a week folds once scrolled past, and unfolds when scrolled back', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    const cards = tree.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.accessibilityLabel === undefined);
    await act(async () => {
      cards[0].props.onLayout({ nativeEvent: { layout: { x: 0, y: 100, width: 300, height: 400 } } });
    });
    const scroller = tree.root.findAll((n) => typeof n.props.onScroll === 'function')[0];
    const scrollTo = async (y: number) =>
      act(async () => {
        scroller.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } });
      });
    const openWeeks = () =>
      new Set(
        tree.root
          .findAll((n) => n.props.accessibilityState?.expanded === true && n.props.accessibilityLabel != null)
          .map((n) => n.props.accessibilityLabel)
      ).size;
    expect(openWeeks()).toBe(3);
    await scrollTo(600);
    expect(openWeeks()).toBe(2);
    cards[0].props.onLayout({ nativeEvent: { layout: { x: 0, y: 100, width: 300, height: 44 } } }); // folded: header only
    await scrollTo(120);
    expect(openWeeks()).toBe(3);
  });

  it('a week folded by hand stays folded while scrolling', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await press(tree, 'B1W2');
    const isOpen = (label: string) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.accessibilityState?.expanded === true).length > 0;
    expect(isOpen('B1W2')).toBe(false);
    // Week 1 slides past the top (the scroll-based fold kicks in), then back.
    const cards = tree.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.accessibilityLabel === undefined);
    await act(async () => {
      cards[0].props.onLayout({ nativeEvent: { layout: { x: 0, y: 100, width: 300, height: 400 } } });
    });
    const scroller = tree.root.findAll((n) => typeof n.props.onScroll === 'function')[0];
    for (const y of [600, 0]) {
      await act(async () => {
        scroller.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } });
      });
    }
    expect(isOpen('B1W2')).toBe(false);
    expect(isOpen('B1W1')).toBe(true);
  });

  it('a day ahead is confirmed for 18:00; a day behind goes straight into Xả with its prime', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const logPast = jest.fn().mockResolvedValue(undefined);
    useEnergyStore.setState({ logActivityForPastDate: logPast });
    const tree = await mount(<BlockPlanView />);

    await press(tree, '✓ Sẽ tập'); // Monday 14.09 — ahead of "today" (08.09)
    expect(useBlockStore.getState().activeBlock?.weeks[1].days[0].session).toMatchObject({
      status: 'planned',
      date: '2026-09-14',
    });
    expect(textOf(tree.root)).toContain('⏰ 18:00');
    expect(logPast).not.toHaveBeenCalled();

    await press(tree, '✓ Đã tập'); // Monday 07.09 — already behind
    expect(logPast).toHaveBeenCalledTimes(1);
    const [{ workouts }, timestamp] = logPast.mock.calls[0];
    expect(timestamp).toBe(new Date('2026-09-07T18:00:00').getTime());
    expect(workouts[0].type).toBe('bench_press');
    expect(workouts[0].sets[0].kind).toBe('warmup');
    expect(useBlockStore.getState().activeBlock?.weeks[0].days[0].session?.status).toBe('logged');
  });

  it('offers to recalculate an old-model block, keeping it until the user taps', async () => {
    const old = plan();
    for (const w of old.weeks) for (const d of w.days) for (const v of d.variations) delete (v as { reference?: unknown }).reference;
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(old);
    jest.mocked(trainingBlockRepository.updateTrainingBlock).mockResolvedValue(undefined);
    const tree = await mount(<BlockPlanView />);
    expect(textOf(tree.root)).toContain('công thức cũ');
    await press(tree, 'Cập nhật gợi ý');
    expect(trainingBlockRepository.updateTrainingBlock).toHaveBeenCalledTimes(1);
    expect(useBlockStore.getState().activeBlock?.weeks[0].days[0].variations[0].reference?.method).toBe('rpe');
  });
});
