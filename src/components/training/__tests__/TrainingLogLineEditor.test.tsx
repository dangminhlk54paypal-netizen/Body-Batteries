import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { TrainingLogLineEditor } from '../TrainingLogLineEditor';
import { useTrainingLogStore } from '../../../store/trainingLogStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useEnergyStore } from '../../../store/energyStore';
import { trainingDaySignature } from '../../../domain/training/trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import { dateString } from '../../../lib/dateUtils';
import type { TrainingLogDayRecord } from '../../../types/trainingLog';
import type { ActivityLogEntry, WorkoutSession } from '../../../types/energy';
import * as activityLogRepository from '../../../data/repositories/activityLogRepository';
import * as trainingLogRepository from '../../../data/repositories/trainingLogRepository';

// Render-level tests of the editor: what it shows for a day, and which store
// action each kind of edit calls. (The BottomSheet is a gesture/animation
// wrapper — replaced by a plain container here.)
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
jest.mock('../../../data/repositories/trainingBlockRepository');
jest.mock('../../../data/repositories/trainingLogRepository');
jest.mock('../../../data/repositories/liftMaxRepository');

const activityRepo = jest.mocked(activityLogRepository);
const logRepo = jest.mocked(trainingLogRepository);

// A few days back, whatever today is, so the typed-date default is valid.
const PAST = dateString(new Date(Date.now() - 5 * 86_400_000));

const squatEntry = (date = PAST): ActivityLogEntry => ({
  id: 'a',
  timestamp: new Date(`${date}T18:00:00`).getTime(),
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
  energyDayApplied: date,
});
const AUTO_BODY = 'S 130 2x3x115';

const runEntry = (date = PAST): ActivityLogEntry => ({
  ...squatEntry(date),
  id: 'r',
  workouts: [{ type: 'running', minutes: 30 } as WorkoutSession],
});

const record = (patch: Partial<TrainingLogDayRecord> = {}): TrainingLogDayRecord => ({
  date: PAST,
  overrideText: null,
  note: null,
  sourceSignature: null,
  updatedAt: 1,
  ...patch,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];
const originalStore = useTrainingLogStore.getState();
const actions = {
  saveManualDay: jest.fn(),
  saveDayOverride: jest.fn(),
  clearDayOverride: jest.fn(),
  saveDayNote: jest.fn(),
  deleteDay: jest.fn(),
  findPreviousDayBody: jest.fn(),
  writeNotebook: jest.fn(),
};
const originalEnergy = useEnergyStore.getState();
const logActivityForPastDate = jest.fn();

async function render(
  props: { mode?: 'add' | 'edit'; entries?: ActivityLogEntry[]; rec?: TrainingLogDayRecord | null } = {},
  handlers: { onClose?: () => void; onEditEntry?: (e: ActivityLogEntry) => void } = {}
) {
  activityRepo.getActivityLogForDate.mockResolvedValue(props.entries ?? []);
  logRepo.getTrainingLogDay.mockResolvedValue(props.rec ?? null);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <TrainingLogLineEditor
        visible
        mode={props.mode ?? 'edit'}
        initialDate={PAST}
        onClose={handlers.onClose ?? (() => undefined)}
        onEditEntry={handlers.onEditEntry ?? (() => undefined)}
      />
    );
  });
  mounted.push(tree);
  return tree;
}

function instanceText(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(instanceText).join('');
}
const allText = (tree: TestRenderer.ReactTestRenderer) => instanceText(tree.root);

// The TextInput with this accessibilityLabel / placeholder.
function inputBy(tree: TestRenderer.ReactTestRenderer, by: { label?: string; placeholder?: string }) {
  const hit = tree.root.findAll(
    (n) =>
      typeof n.props.onChangeText === 'function' &&
      (by.label ? n.props.accessibilityLabel === by.label : n.props.placeholder === by.placeholder)
  )[0];
  if (!hit) throw new Error(`no input ${JSON.stringify(by)}`);
  return hit;
}
async function type(tree: TestRenderer.ReactTestRenderer, by: { label?: string; placeholder?: string }, text: string) {
  await act(async () => {
    inputBy(tree, by).props.onChangeText(text);
  });
}
const LINE = { label: 'Nội dung buổi tập' };
const NOTE = { label: 'Ghi chú dưới ngày' };

function pressable(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hit = tree.root.findAll((n) => typeof n.props.onPress === 'function' && instanceText(n).includes(label))[0];
  if (!hit) throw new Error(`no pressable "${label}"`);
  return hit;
}
async function press(tree: TestRenderer.ReactTestRenderer, label: string) {
  await act(async () => {
    pressable(tree, label).props.onPress();
  });
}
const saveBtn = (tree: TestRenderer.ReactTestRenderer) => pressable(tree, 'Lưu');

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(actions).forEach((a) => a.mockResolvedValue(undefined));
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark', trainingLogFormat: DEFAULT_TRAINING_LOG_FORMAT });
  useTrainingLogStore.setState(actions);
  logActivityForPastDate.mockResolvedValue(undefined);
  useEnergyStore.setState({ logActivityForPastDate });
});
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  useTrainingLogStore.setState(originalStore);
  useEnergyStore.setState(originalEnergy);
});

describe('TrainingLogLineEditor — adding a hand-written entry', () => {
  it('starts with Save disabled, then turns a readable line into a NEW Xả session of that day', async () => {
    const onClose = jest.fn();
    const tree = await render({ mode: 'add' }, { onClose });
    expect(saveBtn(tree).props.disabled).toBe(true);

    await type(tree, LINE, 'S 120 5x4x100');
    expect(saveBtn(tree).props.disabled).toBe(false);
    // The preview says what will be created.
    expect(allText(tree)).toContain('Sẽ tạo buổi Xả gồm');
    await press(tree, 'Lưu');

    expect(logActivityForPastDate).toHaveBeenCalledTimes(1);
    const [activity, timestamp] = logActivityForPastDate.mock.calls[0];
    expect(activity.workouts[0]).toMatchObject({ type: 'squat' });
    expect(dateString(new Date(timestamp))).toBe(PAST);
    // The session prints the same line → nothing hand-written is kept.
    expect(actions.writeNotebook).toHaveBeenCalledWith({
      days: [{ date: PAST, overrideText: null, note: null, sourceSignature: null }],
      deleteDates: [],
      weeks: [],
    });
    expect(actions.saveManualDay).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('with "Tạo buổi Xả" switched off, the line stays hand-written', async () => {
    const tree = await render({ mode: 'add' });
    await type(tree, LINE, 'S 120 5x4x100');
    const toggle = tree.root.findAll((n) => typeof n.props.onValueChange === 'function')[0];
    await act(async () => {
      toggle.props.onValueChange(false);
    });
    await press(tree, 'Lưu');
    expect(logActivityForPastDate).not.toHaveBeenCalled();
    expect(actions.saveManualDay).toHaveBeenCalledWith(PAST, 'S 120 5x4x100', '');
  });

  it('a line it cannot read stays hand-written and says why', async () => {
    const tree = await render({ mode: 'add' });
    await type(tree, LINE, 'đi bơi 30 phút');
    expect(allText(tree)).toContain('Chưa tạo được buổi Xả');
    await press(tree, 'Lưu');
    expect(logActivityForPastDate).not.toHaveBeenCalled();
    expect(actions.saveManualDay).toHaveBeenCalledWith(PAST, 'đi bơi 30 phút', '');
  });

  it('can be a note only', async () => {
    const tree = await render({ mode: 'add' });
    await type(tree, NOTE, 'nghỉ lễ');
    await press(tree, 'Lưu');
    expect(actions.saveManualDay).toHaveBeenCalledWith(PAST, '', 'nghỉ lễ');
  });

  it('uses the typed date, not the suggested one', async () => {
    const tree = await render({ mode: 'add' });
    const twoDaysAgo = dateString(new Date(Date.now() - 2 * 86_400_000));
    const [, mm, dd] = twoDaysAgo.split('-');
    await type(tree, { placeholder: 'dd.mm' }, `${dd}.${mm}`);
    await type(tree, LINE, 'D 140 6x4x110');
    await press(tree, 'Lưu');
    expect(dateString(new Date(logActivityForPastDate.mock.calls[0][1]))).toBe(twoDaysAgo);
    expect(actions.writeNotebook.mock.calls[0][0].days[0].date).toBe(twoDaysAgo);
  });

  it('rejects a date that is not a date, and keeps Save disabled', async () => {
    const tree = await render({ mode: 'add' });
    await type(tree, LINE, 'S 100 5');
    await type(tree, { placeholder: 'dd.mm' }, 'abc');
    expect(allText(tree)).toContain('Nhập ngày dạng dd.mm');
    expect(saveBtn(tree).props.disabled).toBe(true);
  });

  it('rejects a date older than the limit, with the limit in the message', async () => {
    const tree = await render({ mode: 'add' });
    await type(tree, LINE, 'S 100 5');
    await type(tree, { placeholder: 'dd.mm' }, '01.01.2020');
    expect(allText(tree)).toContain('tối đa 730 ngày');
    expect(saveBtn(tree).props.disabled).toBe(true);
  });

  it('a day that already has content says so and edits it', async () => {
    const tree = await render({ mode: 'add', entries: [squatEntry()] });
    expect(allText(tree)).toContain('Ngày này đã có nội dung');
    expect(inputBy(tree, LINE).props.value).toBe(AUTO_BODY);
  });

  it('“copy latest session” fills the line, or says there is nothing to copy', async () => {
    actions.findPreviousDayBody.mockResolvedValueOnce('D 140 6x4x110');
    const tree = await render({ mode: 'add' });
    await press(tree, 'Chép buổi gần nhất');
    expect(actions.findPreviousDayBody).toHaveBeenCalledWith(PAST);
    expect(inputBy(tree, LINE).props.value).toBe('D 140 6x4x110');

    actions.findPreviousDayBody.mockResolvedValueOnce(null);
    const empty = await render({ mode: 'add' });
    await press(empty, 'Chép buổi gần nhất');
    expect(allText(empty)).toContain('Chưa có buổi nào trước ngày này');
  });
});

describe('TrainingLogLineEditor — editing a day logged in Xả', () => {
  it('shows the automatic line, and saving it unchanged writes nothing', async () => {
    const onClose = jest.fn();
    const tree = await render({ entries: [squatEntry()] }, { onClose });
    expect(inputBy(tree, LINE).props.value).toBe(AUTO_BODY);
    await press(tree, 'Lưu');
    expect(actions.saveDayOverride).not.toHaveBeenCalled();
    expect(actions.clearDayOverride).not.toHaveBeenCalled();
    expect(actions.saveDayNote).not.toHaveBeenCalled();
    expect(actions.saveManualDay).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saving a changed line stores an override bound to the current entries', async () => {
    const entries = [squatEntry()];
    const tree = await render({ entries });
    await type(tree, LINE, 'S 130 (95 ❌) 2x3x115');
    await press(tree, 'Lưu');
    expect(actions.saveDayOverride).toHaveBeenCalledWith(PAST, 'S 130 (95 ❌) 2x3x115', trainingDaySignature(entries));
    expect(actions.saveManualDay).not.toHaveBeenCalled();
  });

  it('changing only the note saves the note and leaves the line alone', async () => {
    const tree = await render({ entries: [squatEntry()] });
    await type(tree, NOTE, 'Cảm giác nặng');
    await press(tree, 'Lưu');
    expect(actions.saveDayNote).toHaveBeenCalledWith(PAST, 'Cảm giác nặng');
    expect(actions.saveDayOverride).not.toHaveBeenCalled();
  });

  it('writing the automatic text back (or clearing the box) drops an existing override', async () => {
    const rec = record({ overrideText: 'custom', sourceSignature: 'x' });
    const tree = await render({ entries: [squatEntry()], rec });
    expect(inputBy(tree, LINE).props.value).toBe('custom');
    await type(tree, LINE, AUTO_BODY);
    await press(tree, 'Lưu');
    expect(actions.clearDayOverride).toHaveBeenCalledWith(PAST);
    expect(actions.saveDayOverride).not.toHaveBeenCalled();
  });

  it('with a stale override it offers the current automatic line and can use it', async () => {
    const rec = record({ overrideText: 'custom', sourceSignature: 'stale' });
    const tree = await render({ entries: [squatEntry()], rec });
    expect(allText(tree)).toContain('Bản tự động hiện tại:');
    await press(tree, 'Dùng bản này');
    expect(inputBy(tree, LINE).props.value).toBe(AUTO_BODY);
  });

  it('“restore automatic line” asks first, then clears the override', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const rec = record({ overrideText: 'custom', sourceSignature: 'x' });
    const tree = await render({ entries: [squatEntry()], rec }, { onClose });
    await press(tree, 'Khôi phục dòng tự động');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(actions.clearDayOverride).not.toHaveBeenCalled();
    await act(async () => {
      await alertSpy.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(actions.clearDayOverride).toHaveBeenCalledWith(PAST);
    expect(onClose).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('“delete this line” asks first, then deletes the day’s log record', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const tree = await render({ entries: [squatEntry()], rec: record({ note: 'x' }) });
    await press(tree, 'Xoá dòng này khỏi sổ');
    expect(actions.deleteDay).not.toHaveBeenCalled();
    await act(async () => {
      await alertSpy.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(actions.deleteDay).toHaveBeenCalledWith(PAST);
    alertSpy.mockRestore();
  });

  it('a day with no log record has no delete / restore buttons', async () => {
    const tree = await render({ entries: [squatEntry()] });
    expect(allText(tree)).not.toContain('Xoá dòng này khỏi sổ');
    expect(allText(tree)).not.toContain('Khôi phục dòng tự động');
  });
});

describe('TrainingLogLineEditor — hand-written day', () => {
  it('saving a readable hand-written day turns it into a Xả session, keeping the note', async () => {
    const rec = record({ overrideText: 'D 140 6x4x110', note: 'tốt' });
    const tree = await render({ rec });
    expect(inputBy(tree, LINE).props.value).toBe('D 140 6x4x110');
    expect(inputBy(tree, NOTE).props.value).toBe('tốt');
    await type(tree, LINE, 'D 142.5 6x4x110');
    await press(tree, 'Lưu');
    expect(logActivityForPastDate.mock.calls[0][0].workouts[0]).toMatchObject({ type: 'deadlift' });
    expect(actions.writeNotebook.mock.calls[0][0].days[0]).toMatchObject({ date: PAST, note: 'tốt' });
  });

  it('with the switch off, a hand-written day is edited through saveManualDay, keeping the note', async () => {
    const rec = record({ overrideText: 'D 140 6x4x110', note: 'tốt' });
    const tree = await render({ rec });
    await type(tree, LINE, 'D 142.5 6x4x110');
    const toggle = tree.root.findAll((n) => typeof n.props.onValueChange === 'function')[0];
    await act(async () => {
      toggle.props.onValueChange(false);
    });
    await press(tree, 'Lưu');
    expect(actions.saveManualDay).toHaveBeenCalledWith(PAST, 'D 142.5 6x4x110', 'tốt');
  });

  it('emptying both the line and the note deletes the record', async () => {
    const rec = record({ overrideText: 'D 140 6x4x110', note: 'tốt' });
    const tree = await render({ rec });
    await type(tree, LINE, '');
    await type(tree, NOTE, '');
    await press(tree, 'Lưu');
    expect(actions.deleteDay).toHaveBeenCalledWith(PAST);
    expect(actions.saveManualDay).not.toHaveBeenCalled();
  });
});

describe('TrainingLogLineEditor — changing the numbers (Tầng B)', () => {
  it('a lifting entry has “Sửa số liệu”, which hands the entry to the parent', async () => {
    const onEditEntry = jest.fn();
    const entry = squatEntry();
    const tree = await render({ entries: [entry] }, { onEditEntry });
    await press(tree, 'Sửa số liệu');
    expect(onEditEntry).toHaveBeenCalledWith(entry);
  });

  it('a minutes-only entry has no such button, only a pointer to History', async () => {
    const tree = await render({ entries: [runEntry()] });
    // (The hint sentence itself mentions "Sửa số liệu", so look for a BUTTON.)
    expect(() => pressable(tree, 'Sửa số liệu')).toThrow();
    expect(allText(tree)).toContain('sửa ở màn Lịch sử');
  });
});
