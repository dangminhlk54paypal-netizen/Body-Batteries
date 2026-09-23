import { useSettingsStore } from '../settingsStore';
import { DEFAULT_TRAINING_LOG_FORMAT, resolveTrainingLogFormat } from '../../types/trainingLog';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => {
  useSettingsStore.setState({ trainingLogFormat: DEFAULT_TRAINING_LOG_FORMAT });
});

describe('training log format settings', () => {
  it('defaults match the user’s own notes (short labels, dot decimals)', () => {
    const f = useSettingsStore.getState().trainingLogFormat;
    expect(f).toMatchObject({ labelStyle: 'short', decimal: 'dot', showWarmups: false, showUnit: false });
    expect(f.showBodyWeight).toBe(true);
  });

  it('setTrainingLogFormat patches only the given options', () => {
    useSettingsStore.getState().setTrainingLogFormat({ showWarmups: true, decimal: 'locale' });
    const f = useSettingsStore.getState().trainingLogFormat;
    expect(f.showWarmups).toBe(true);
    expect(f.decimal).toBe('locale');
    expect(f.labelStyle).toBe('short');
  });

  it('setTrainingLogAbbreviation sets an override and removes it on a blank value', () => {
    const { setTrainingLogAbbreviation } = useSettingsStore.getState();
    setTrainingLogAbbreviation('var:bench_incline', ' IC ');
    expect(useSettingsStore.getState().trainingLogFormat.abbreviations).toEqual({
      'var:bench_incline': 'IC',
    });
    setTrainingLogAbbreviation('lift:squat', 'Sq');
    setTrainingLogAbbreviation('var:bench_incline', '   ');
    expect(useSettingsStore.getState().trainingLogFormat.abbreviations).toEqual({ 'lift:squat': 'Sq' });
  });

  it('does not mutate the shared default object', () => {
    useSettingsStore.getState().setTrainingLogAbbreviation('lift:squat', 'Sq');
    expect(DEFAULT_TRAINING_LOG_FORMAT.abbreviations).toEqual({});
  });
});

describe('resolveTrainingLogFormat', () => {
  it('fills options missing from an older saved shape with their defaults', () => {
    // A device that persisted before showWeekday/abbreviations existed.
    const legacy = { labelStyle: 'full', decimal: 'locale' } as Partial<typeof DEFAULT_TRAINING_LOG_FORMAT>;
    const f = resolveTrainingLogFormat(legacy);
    expect(f.labelStyle).toBe('full');
    expect(f.decimal).toBe('locale');
    expect(f.showWeekday).toBe(false);
    expect(f.abbreviations).toEqual({});
  });

  it('handles nothing stored at all', () => {
    expect(resolveTrainingLogFormat(null)).toEqual(DEFAULT_TRAINING_LOG_FORMAT);
    expect(resolveTrainingLogFormat(undefined)).toEqual(DEFAULT_TRAINING_LOG_FORMAT);
  });
});
