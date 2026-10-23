import React from 'react';
import { Alert } from 'react-native';
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
      (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Giải thích: TnG Bench'
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

  it('a day can be dropped ("Nghỉ") and taken back', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await act(async () => {
      tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === 'Nghỉ')[0].props.onPress();
    });
    const day = () => useBlockStore.getState().activeBlock!.weeks.find((w) => w.days[0].skipped)?.days[0];
    expect(day()?.skipped).toBe(true);
    await press(tree, 'Không tập · ↺');
    expect(day()).toBeUndefined();
  });

  it('a week off: the user picks "skip this week" (dates stay) or "move the later weeks"', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    let choice = 'Bỏ tuần này';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === choice)?.onPress?.();
    });
    const tree = await mount(<BlockPlanView />);
    const before = plan().weeks.map((w) => w.startDate);

    await press(tree, '🏖 Nghỉ');
    const skipped = useBlockStore.getState().activeBlock!;
    expect(skipped.weeks.some((w) => w.skipped)).toBe(true);
    expect(skipped.weeks.map((w) => w.startDate)).toEqual(before);
    await press(tree, '↺ Tập lại');
    expect(useBlockStore.getState().activeBlock!.weeks.some((w) => w.skipped)).toBe(false);

    choice = 'Dời các tuần sau';
    await press(tree, '🏖 Nghỉ');
    const paused = useBlockStore.getState().activeBlock!;
    expect(paused.config.breaks).toHaveLength(1);
    expect(textOf(tree.root)).toContain('🏖 Tuần nghỉ');
    alert.mockRestore();
  });

  it('adds the user’s own accessory lines to a planned day, for the later weeks too', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await act(async () => {
      tree.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n) === '＋ Bài phụ')[0].props.onPress();
    });
    await type(tree, 'Tên bài', 'Hip thrust tạ đòn');
    await type(tree, 'Rep / ghi chú', '8 @60kg');
    await press(tree, 'Lưu');
    const weeks = useBlockStore.getState().activeBlock!.weeks;
    const edited = weeks.findIndex((w) => w.days[0].accessories.length > 0);
    expect(weeks[edited].days[0].accessories).toEqual([{ customName: 'Hip thrust tạ đòn', sets: 3, reps: '8 @60kg' }]);
    expect(weeks.slice(edited).every((w) => w.days[0].accessories[0]?.customName === 'Hip thrust tạ đòn')).toBe(true);
    expect(textOf(tree.root)).toContain('Hip thrust tạ đòn');
  });

  it('"Theo bài": one lift as a week × day grid; tapping a square edits that session in place', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await press(tree, '🏋️ Theo bài');
    const cells = tree.root.findAll(
      (n) => typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel ?? '').startsWith('Sửa ')
    );
    expect(cells).toHaveLength(3); // bench on Monday × 3 weeks (2 progressive + deload)
    await act(async () => cells[1].props.onPress()); // week 2
    const label = tree.root.findAll((n) => typeof n.props.onChangeText === 'function')[0].props.accessibilityLabel;
    await type(tree, label, '100x1 5x5x85');
    await press(tree, 'Lưu');
    const v = useBlockStore.getState().activeBlock!.weeks[1].days[0].variations[0];
    expect(v.userEdited).toBe(true);
    expect(v.sets.map((s) => `${s.weightKg}x${s.reps}`)).toEqual(['100x1', ...Array(5).fill('85x5')]);
    expect(textOf(tree.root)).toContain('✎');
  });

  it('"Form": TM on top, rows typed in % of the TM, and a new TM moves the sessions ahead', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    const tree = await mount(<BlockPlanView />);
    await press(tree, '📋 Form');
    expect(input(tree, 'Training Max của TnG Bench').props.value).toBe('120');
    await type(tree, 'TnG Bench, B1W2', '1x1@94% 5x5@81%');
    expect(textOf(tree.root)).toContain('1×1 @ 112,5 94%');
    await press(tree, 'Lưu 1 dòng');
    const working = (w: number) =>
      useBlockStore.getState().activeBlock!.weeks[w].days[0].variations[0].sets.filter((s) => s.kind === 'working').map((s) => s.weightKg);
    expect(working(1)).toEqual([112.5, ...Array(5).fill(97.5)]);

    await type(tree, 'Training Max của TnG Bench', '125');
    await press(tree, 'Áp dụng');
    expect(useBlockStore.getState().activeBlock!.config.trainingMax).toEqual({ bench_touch_and_go: 125 });
    // 112,5 × 125/120 = 117,2 → 117,5; 97,5 → 101,6 → 102,5 (rounded to 2,5 kg).
    expect(working(1)).toEqual([117.5, ...Array(5).fill(102.5)]);
  });

  it('a trained day takes an RPE rating; two easy sessions bring a coach suggestion the user can apply', async () => {
    jest.mocked(trainingBlockRepository.getActiveTrainingBlock).mockResolvedValue(plan());
    // Both Mondays already have a lifting Xả → the squares are "done".
    const lifted = ['2026-09-07', '2026-09-14'].map((date, i) => ({
      id: `x${i}`,
      timestamp: new Date(`${date}T18:00:00`).getTime(),
      steps: 0,
      energyKcal: 100,
      satietyDrainKcal: 0,
      energyDayApplied: date,
      workouts: [{ type: 'bench_press' as const, minutes: 30, sets: [{ kind: 'working' as const, weightKg: 70, reps: 5 }] }],
    }));
    jest.mocked(getActivityLogInRange).mockResolvedValue(lifted);
    const tree = await mount(<BlockPlanView />);
    await act(async () => {}); // the log loads
    for (let i = 0; i < 2; i++) {
      await press(tree, 'RPE ?');
      await act(async () => {
        tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'RPE 5')[0].props.onPress();
      });
    }
    const weeks = () => useBlockStore.getState().activeBlock!.weeks;
    expect(weeks().slice(0, 2).map((w) => w.days[0].variations[0].actualRpe)).toEqual([5, 5]);
    expect(textOf(tree.root)).toContain('🧭 Gợi ý theo RPE');
    const before = weeks()[2].days[0].variations[0].sets.filter((x) => x.kind === 'working')[0].weightKg;
    await press(tree, '＋2,5 kg');
    expect(weeks()[2].days[0].variations[0].sets.filter((x) => x.kind === 'working')[0].weightKg).toBe(before + 2.5);
    expect(textOf(tree.root)).not.toContain('🧭 Gợi ý theo RPE'); // applied → gone
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
