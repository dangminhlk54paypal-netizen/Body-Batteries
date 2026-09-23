import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { TrainingLogDayLine } from '../TrainingLogDayLine';
import { useTrainingLogStore } from '../../../store/trainingLogStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { trainingDaySignature } from '../../../domain/training/trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogDayRecord } from '../../../types/trainingLog';
import type { ActivityLogEntry } from '../../../types/energy';

// Render-level smoke test of the notebook's day line: what text it shows for an
// auto line / hand-written line / edited line, and that the conflict banner
// calls the right store action. (No device here, so this is the closest thing
// to seeing it.)
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../data/repositories/activityLogRepository');
jest.mock('../../../data/repositories/trainingBlockRepository');
jest.mock('../../../data/repositories/trainingLogRepository');

const entry: ActivityLogEntry = {
  id: 'a',
  timestamp: new Date(2026, 7, 26, 18).getTime(),
  steps: 0,
  workouts: [
    {
      type: 'squat',
      minutes: 30,
      sets: [
        { kind: 'working', weightKg: 130, reps: 1 },
        { kind: 'working', weightKg: 115, reps: 3 },
        { kind: 'working', weightKg: 115, reps: 3 },
      ],
    },
  ],
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-08-26',
};

const record = (patch: Partial<TrainingLogDayRecord>): TrainingLogDayRecord => ({
  date: '2026-08-26',
  overrideText: null,
  note: null,
  sourceSignature: null,
  updatedAt: 1,
  ...patch,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];
const originalStore = useTrainingLogStore.getState();

function render(props: Partial<React.ComponentProps<typeof TrainingLogDayLine>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <TrainingLogDayLine
        date="2026-08-26"
        entries={[entry]}
        record={undefined}
        weightKg={null}
        format={DEFAULT_TRAINING_LOG_FORMAT}
        {...props}
      />
    );
  });
  mounted.push(tree);
  return tree;
}

// All rendered text, joined — nested <Text> children flatten in order.
function textOf(tree: TestRenderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: TestRenderer.ReactTestRendererNode) => {
    if (typeof n === 'string') out.push(n);
    else (n.children ?? []).forEach(walk);
  };
  (tree.toJSON() as TestRenderer.ReactTestRendererJSON | null)?.children?.forEach(walk);
  return out.join('');
}

function instanceText(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(instanceText).join('');
}

// The (outermost) pressable whose visible text contains `label`.
function pressableWithText(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hit = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && instanceText(n).includes(label)
  )[0];
  if (!hit) throw new Error(`no pressable with text "${label}"`);
  return hit;
}

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
});

afterEach(() => {
  // Unmount first (mounted lines subscribe to the store), then put back the
  // real actions a test may have replaced with mocks.
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  useTrainingLogStore.setState(originalStore);
});

describe('TrainingLogDayLine', () => {
  it('shows the auto-generated line with the date prefix', () => {
    expect(textOf(render())).toBe('26.08: S 130 2x3x115');
  });

  it('adds the body weight to the prefix when there is a reading', () => {
    expect(textOf(render({ weightKg: 77.7 }))).toBe('26.08(77.7kg): S 130 2x3x115');
  });

  it('shows the user’s override instead, with ✎, when it matches the entries', () => {
    const rec = record({ overrideText: 'S 130 (test)', sourceSignature: trainingDaySignature([entry]) });
    expect(textOf(render({ record: rec }))).toBe('26.08: S 130 (test) ✎');
  });

  it('shows a hand-written line (no entries) with ✍ and no banner', () => {
    const rec = record({ overrideText: 'D 140 6x4x110' });
    expect(textOf(render({ entries: [], record: rec }))).toBe('26.08: D 140 6x4x110 ✍');
  });

  it('shows the note under the line', () => {
    const out = textOf(render({ record: record({ note: 'Cảm giác nặng' }) }));
    expect(out).toContain('S 130 2x3x115');
    expect(out).toContain('Cảm giác nặng');
  });

  it('a note-only day with no Xả shows just the date and the note', () => {
    const out = textOf(render({ entries: [], record: record({ note: 'nghỉ' }) }));
    expect(out).toBe('26.08:nghỉ');
  });

  it('warns when Xả was added under a hand-written line, and Merge calls the store', () => {
    const merge = jest.fn().mockResolvedValue(undefined);
    useTrainingLogStore.setState({ mergeAutoIntoOverride: merge });
    const rec = record({ overrideText: 'B 90 (95 ❌)' });
    const tree = render({ record: rec });
    expect(textOf(tree)).toContain('vừa có buổi ghi từ mục Xả');

    // Braces matter: a returned promise would make act() async and never settle.
    act(() => {
      pressableWithText(tree, 'Gộp').props.onPress();
    });
    expect(merge).toHaveBeenCalledWith('2026-08-26', 'S 130 2x3x115', trainingDaySignature([entry]));
  });

  it('“use automatic line” asks for confirmation before dropping the user’s text', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const clear = jest.fn().mockResolvedValue(undefined);
    useTrainingLogStore.setState({ clearDayOverride: clear });
    const rec = record({ overrideText: 'x', sourceSignature: 'stale' });
    const tree = render({ record: rec });
    expect(textOf(tree)).toContain('đã đổi sau khi bạn sửa tay');

    act(() => {
      pressableWithText(tree, 'Dùng dòng tự động').props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled(); // only after the destructive button is confirmed

    const buttons = alertSpy.mock.calls[0][2]!;
    act(() => {
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(clear).toHaveBeenCalledWith('2026-08-26');
    alertSpy.mockRestore();
  });

  it('a user-written line whose Xả entries were all removed shows a hint, not buttons', () => {
    const rec = record({ overrideText: 'S 130 (test)', sourceSignature: 'stale' });
    const tree = render({ entries: [], record: rec });
    expect(textOf(tree)).toContain('Không còn buổi tập nào trong mục Xả');
    expect(textOf(tree)).not.toContain('Gộp');
  });
});
