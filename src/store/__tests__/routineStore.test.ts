import { useRoutineStore } from '../routineStore';
import { useEnergyStore } from '../energyStore';
import { todayString } from '../../lib/dateUtils';

jest.mock('../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../data/db/database', () => ({ getDb: jest.fn(), __esModule: true }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../data/repositories/intakeRepository', () => ({
  getIntakeEventsInRange: jest.fn(async () => []),
}));

function spyEnergy() {
  const addIntake = jest.fn(async () => []);
  const logActivity = jest.fn(async () => {});
  const removeIntake = jest.fn(async () => {});
  const removeActivity = jest.fn(async () => {});
  useEnergyStore.setState({ addIntake, logActivity, removeIntake, removeActivity, activityLog: [] } as never);
  return { addIntake, logActivity, removeIntake, removeActivity };
}

beforeEach(() => {
  useRoutineStore.setState({
    day: { date: todayString(), handledSlots: {}, autoFilled: {}, autoBannerDismissed: false, optInSnoozed: false },
  });
});

describe('logMetric', () => {
  it('logs sleep and water as pin charges with no visible note', async () => {
    const { addIntake } = spyEnergy();
    await useRoutineStore.getState().logMetric('water', 500, 1000);
    expect(addIntake).toHaveBeenCalledWith('water', 500, '', { timestamp: 1000 });
  });

  it('logs steps and walking as activities, so the goal grows and the log shows them', async () => {
    const { addIntake, logActivity } = spyEnergy();
    await useRoutineStore.getState().logMetric('steps', 5000, 1000);
    await useRoutineStore.getState().logMetric('walkMinutes', 30, 2000);
    expect(addIntake).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenNthCalledWith(1, { steps: 5000 }, 1000);
    expect(logActivity).toHaveBeenNthCalledWith(2, { workouts: [{ type: 'walking', minutes: 30 }] }, 2000);
  });
});

describe('auto-fill', () => {
  it('removes exactly the rows it wrote on undo and does not fill them again', async () => {
    const { removeIntake, removeActivity } = spyEnergy();
    await useRoutineStore.getState().applyAutoFill([
      { metric: 'water', amount: 2000 },
      { metric: 'steps', amount: 5000 },
      { metric: 'walkMinutes', amount: 30 },
    ]);
    const { autoFilled } = useRoutineStore.getState().day;
    expect(autoFilled.walkMinutes).toBeUndefined();
    useEnergyStore.setState({ activityLog: [{ id: 'walk', timestamp: autoFilled.steps!.at }] } as never);

    await useRoutineStore.getState().undoAutoFill();

    expect(removeIntake).toHaveBeenCalledWith(`water_${autoFilled.water!.at}`);
    expect(removeActivity).toHaveBeenCalledWith('walk');
    const after = useRoutineStore.getState().day;
    expect(after.autoFilled.water?.amount).toBe(0);
    expect(after.autoBannerDismissed).toBe(true);
  });
});
