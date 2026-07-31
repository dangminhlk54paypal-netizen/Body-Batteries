import { translateText, autoTranslateCustomFoodName } from '../foodNameTranslationService';
import { addCustomFoodAndRegister } from '../../../data/food/customFoodRegistry';
import { useSettingsStore } from '../../../store/settingsStore';
import type { FoodItem } from '../../../types/food';

jest.mock('../../../data/food/customFoodRegistry', () => ({
  addCustomFoodAndRegister: jest.fn().mockResolvedValue(undefined),
}));

// settingsStore persists via AsyncStorage — use the library's official jest
// mock so importing it (transitively, via foodNameTranslationService) doesn't
// hit the native module. Mirrors src/store/__tests__/energyStore.test.ts.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockAddCustomFoodAndRegister = addCustomFoodAndRegister as jest.Mock;

const EMPTY_NUTRITION = {
  energyKcal: 0,
  waterG: 0,
  proteinG: 0,
  fatG: 0,
  carbG: 0,
  fiberG: 0,
  sugarG: 0,
  calciumMg: 0,
  ironMg: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
  zincMg: 0,
};

function customFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'custom_1',
    nameVi: 'Chuối chiên',
    nameEn: '',
    category: 'custom',
    defaultServingG: 100,
    servingPresets: [],
    per100g: EMPTY_NUTRITION,
    source: 'custom',
    note: '',
    ...overrides,
  };
}

describe('translateText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the translated text on a successful call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'Fried banana' } }),
    }) as unknown as typeof fetch;

    expect(await translateText('Chuối chiên', 'vi', 'en')).toBe('Fried banana');
  });

  it('returns null when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await translateText('x', 'vi', 'en')).toBeNull();
  });

  it('returns null when fetch throws (offline)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    expect(await translateText('x', 'vi', 'en')).toBeNull();
  });

  it('returns null when the response has no usable translatedText', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: { translatedText: '' } }),
    }) as unknown as typeof fetch;
    expect(await translateText('x', 'vi', 'en')).toBeNull();
  });
});

describe('autoTranslateCustomFoodName', () => {
  beforeEach(() => {
    mockAddCustomFoodAndRegister.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useSettingsStore.setState({ autoTranslateCustomFoodNames: false });
  });

  it('does nothing when the opt-in setting is off', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: false });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await autoTranslateCustomFoodName(customFood(), 'vi');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockAddCustomFoodAndRegister).not.toHaveBeenCalled();
  });

  it('does nothing for a catalog-backed food (source !== "custom"), even with the setting on', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await autoTranslateCustomFoodName(customFood({ source: 'USDA' }), 'vi');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockAddCustomFoodAndRegister).not.toHaveBeenCalled();
  });

  it('translates a vi-authored custom food into en and de, and saves the patch', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn(async (url: string) => {
      const translated = url.includes('|en')
        ? 'Fried banana'
        : url.includes('|de')
          ? 'Gebratene Banane'
          : '';
      return { ok: true, json: async () => ({ responseData: { translatedText: translated } }) };
    }) as unknown as typeof fetch;

    const item = customFood();
    await autoTranslateCustomFoodName(item, 'vi');

    expect(mockAddCustomFoodAndRegister).toHaveBeenCalledTimes(1);
    expect(mockAddCustomFoodAndRegister).toHaveBeenCalledWith({
      ...item,
      nameVi: 'Chuối chiên',
      nameEn: 'Fried banana',
      nameDe: 'Gebratene Banane',
    });
  });

  it('when saved in a non-vi language, copies the raw text into that language\'s own field', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn(async (url: string) => {
      const translated = url.includes('|vi')
        ? 'Chuối chiên'
        : url.includes('|de')
          ? 'Gebratene Banane'
          : '';
      return { ok: true, json: async () => ({ responseData: { translatedText: translated } }) };
    }) as unknown as typeof fetch;

    // The text was actually typed in English while the app was in English —
    // buildCustomFoodItem still files it under nameVi (existing behaviour).
    const item = customFood({ nameVi: 'Fried banana' });
    await autoTranslateCustomFoodName(item, 'en');

    expect(mockAddCustomFoodAndRegister).toHaveBeenCalledWith({
      ...item,
      nameVi: 'Chuối chiên',
      nameEn: 'Fried banana',
      nameDe: 'Gebratene Banane',
    });
  });

  it('does not save anything when every translation call fails', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await autoTranslateCustomFoodName(customFood(), 'vi');

    expect(mockAddCustomFoodAndRegister).not.toHaveBeenCalled();
  });

  it('never rejects even when saving the translated patch fails (fire-and-forget contract)', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'Fried banana' } }),
    }) as unknown as typeof fetch;
    mockAddCustomFoodAndRegister.mockRejectedValueOnce(new Error('disk full'));

    await expect(autoTranslateCustomFoodName(customFood(), 'vi')).resolves.toBeUndefined();
  });

  it('does nothing for a blank name', async () => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await autoTranslateCustomFoodName(customFood({ nameVi: '   ' }), 'vi');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockAddCustomFoodAndRegister).not.toHaveBeenCalled();
  });
});
