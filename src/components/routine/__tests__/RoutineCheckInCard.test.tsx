import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { RoutineCheckInCard } from '../RoutineCheckInCard';
import { useRoutineStore } from '../../../store/routineStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { emptyInsights } from '../../../domain/routine/routineEngine';
import { todayString } from '../../../lib/dateUtils';
import { vi } from '../../../i18n/locales/vi';
import { en } from '../../../i18n/locales/en';

jest.mock('../../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function seed(patch: object) {
  useRoutineStore.setState({
    mode: 'off',
    optInAnswered: false,
    insights: emptyInsights(),
    insightsLoaded: true,
    lastBedtime: null,
    lastWakeTime: null,
    day: { date: todayString(), handledSlots: {}, autoFilled: {}, autoBannerDismissed: false, optInSnoozed: false },
    ...patch,
  });
}

async function render(hour: number): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<RoutineCheckInCard hour={hour} />);
  });
  return tree;
}

const inputsOf = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.type === ('TextInput' as never));
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map((n) => String(n.props.children));

async function press(tree: ReactTestRenderer, label: string) {
  const button = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.findAll((m) => m.props.children === label).length > 0
  )[0];
  await act(async () => {
    await button!.props.onPress();
  });
}

beforeEach(() => useSettingsStore.setState({ language: 'vi' }));

describe('RoutineCheckInCard', () => {
  it('shows nothing when off and no routine was found', async () => {
    seed({});
    expect((await render(7)).toJSON()).toBeNull();
  });

  it('asks about sleep in the morning, pre-filled, and logs it on save', async () => {
    const logMetric = jest.fn(async () => {});
    seed({ mode: 'prompt', lastBedtime: '23:00', lastWakeTime: '06:30', logMetric });
    const tree = await render(7);
    const inputs = inputsOf(tree);
    expect(inputs.map((i) => i.props.value)).toEqual(['23:00', '06:30']);
    await press(tree, vi.common.save);
    expect(logMetric).toHaveBeenCalledWith('sleep', 7.5);
    expect(useRoutineStore.getState().day.handledSlots.morning).toBe(true);
  });

  it('pre-fills what is missing in the evening and skips empty fields', async () => {
    const logMetric = jest.fn(async () => {});
    const insights = emptyInsights();
    insights.water = { ...insights.water, suggested: 2000, loggedToday: 500 };
    seed({ mode: 'prompt', insights, logMetric });
    const tree = await render(20);
    expect(inputsOf(tree).map((i) => i.props.value)).toEqual(['1500', '', '']);
    await press(tree, vi.common.save);
    expect(logMetric).toHaveBeenCalledTimes(1);
    expect(logMetric).toHaveBeenCalledWith('water', 1500);
  });

  it('asks once whether to turn this on, in the app’s language', async () => {
    useSettingsStore.setState({ language: 'en' });
    const insights = emptyInsights();
    insights.water = { ...insights.water, isRoutine: true, streakDays: 4 };
    seed({ insights });
    const tree = await render(12);
    expect(texts(tree)).toContain(en.components.routine.optInTitle.replace('{{days}}', '4'));
    await press(tree, en.components.routine.optInAuto);
    expect(useRoutineStore.getState()).toMatchObject({ mode: 'auto', optInAnswered: true });
  });
});
