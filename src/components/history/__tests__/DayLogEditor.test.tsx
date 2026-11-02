import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { DayLogEditor } from '../DayLogEditor';
import { useEnergyStore } from '../../../store/energyStore';
import { useSettingsStore } from '../../../store/settingsStore';
import * as intakeRepository from '../../../data/repositories/intakeRepository';
import * as activityRepository from '../../../data/repositories/activityLogRepository';
import { vi as dict } from '../../../i18n/locales/vi';

jest.mock('../../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const DAY = '2026-10-31';
const NOON = new Date(`${DAY}T12:00:00`).getTime();
const water = { id: 'water_1', timestamp: NOON, batteryTypeId: 'water' as const, amount: 500, note: '' };
const steps = {
  id: 'activity_1',
  timestamp: NOON,
  steps: 4000,
  workouts: [],
  energyKcal: 100,
  satietyDrainKcal: 0,
  energyDayApplied: DAY,
};

let onChanged: jest.Mock;
let actions: Record<string, jest.Mock>;

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<DayLogEditor date={DAY} onChanged={onChanged} />);
  });
  return tree;
}

function pressByA11y(tree: ReactTestRenderer, label: string, index = 0) {
  const found = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label);
  return found.filter((n, i) => found.findIndex((m) => m.props.onPress === n.props.onPress) === i)[index];
}

const inputsOf = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.type === ('TextInput' as never));

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi' });
  jest.spyOn(intakeRepository, 'getIntakeEventsForDate').mockResolvedValue([water]);
  jest.spyOn(activityRepository, 'getActivityLogForDate').mockResolvedValue([steps]);
  onChanged = jest.fn();
  actions = {
    updateIntakeForPastDate: jest.fn(async () => {}),
    updateActivityForPastDate: jest.fn(async () => {}),
    addIntakeForPastDate: jest.fn(async () => {}),
    logActivityForPastDate: jest.fn(async () => {}),
  };
  useEnergyStore.setState(actions as never);
});

describe('DayLogEditor', () => {
  it('lists what was logged that day', async () => {
    const shown = (await render()).root.findAllByType(Text).map((n) => String(n.props.children));
    expect(shown).toContain('Nước');
    expect(shown).toContain(dict.components.routine.metric.steps);
  });

  it('edits a hand-logged amount in place', async () => {
    const tree = await render();
    await act(async () => pressByA11y(tree, dict.common.edit, 0).props.onPress());
    const input = inputsOf(tree)[0];
    expect(input.props.value).toBe('500');
    await act(async () => input.props.onChangeText('800'));
    await act(async () => pressByA11y(tree, dict.common.save).props.onPress());
    expect(actions.updateIntakeForPastDate).toHaveBeenCalledWith(water, 800);
    expect(onChanged).toHaveBeenCalled();
  });

  it('edits the steps of an activity through the activity action', async () => {
    const tree = await render();
    await act(async () => pressByA11y(tree, dict.common.edit, 1).props.onPress());
    await act(async () => inputsOf(tree)[0].props.onChangeText('6000'));
    await act(async () => pressByA11y(tree, dict.common.save).props.onPress());
    expect(actions.updateActivityForPastDate).toHaveBeenCalledWith(steps, { steps: 6000 });
  });

  it('adds forgotten water at noon of that day', async () => {
    const tree = await render();
    const inputs = inputsOf(tree);
    await act(async () => inputs[inputs.length - 1].props.onChangeText('250'));
    await act(async () => pressByA11y(tree, dict.components.dayLogEditor.addA11y).props.onPress());
    expect(actions.addIntakeForPastDate).toHaveBeenCalledWith('water', 250, NOON);
  });
});
