import {
  translateText,
  translateFoodName,
  autoTranslateCustomFoodName,
  recheckStoredFoodTranslations,
} from '../foodNameTranslationService';
import {
  addCustomFoodAndRegister,
  getCustomFoods,
  getCustomFoodByIdSync,
  updateCustomFoodNamesAndRegister,
} from '../../../data/food/customFoodRegistry';
import { getAllOverridesSync, upsertOverrideAndRegister } from '../../../data/food/foodOverrideRegistry';
import { useSettingsStore } from '../../../store/settingsStore';
import type { FoodItem } from '../../../types/food';

jest.mock('../../../data/food/customFoodRegistry', () => ({
  addCustomFoodAndRegister: jest.fn().mockResolvedValue(undefined),
  getCustomFoods: jest.fn(() => []),
  getCustomFoodByIdSync: jest.fn(),
  updateCustomFoodNamesAndRegister: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../data/food/foodOverrideRegistry', () => ({
  getAllOverridesSync: jest.fn(() => []),
  upsertOverrideAndRegister: jest.fn().mockResolvedValue(undefined),
}));

// A fake MyMemory: answers from a small phrase book keyed "src|tgt:text";
// anything else is echoed back (what the real service does when stuck).
function fakeMyMemory(book: Record<string, string>) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    const u = new URL(url);
    const key = `${u.searchParams.get('langpair')}:${u.searchParams.get('q')}`;
    calls.push(key);
    const q = u.searchParams.get('q') ?? '';
    return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: book[key] ?? q } }) };
  }) as unknown as typeof fetch;
  return calls;
}

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
  it('decodes a URL-encoded echo instead of saving %XX escapes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Fischst%C3%A4bchen%20Berida' },
      }),
    }) as unknown as typeof fetch;
    expect(await translateText('Fischstäbchen Berida', 'vi', 'en')).toBe('Fischstäbchen Berida');
  });

  it('returns null when MyMemory reports an error status (quota/invalid pair)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 429,
        responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' },
      }),
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
    fakeMyMemory({
      'vi|en:Chuối chiên': 'Fried banana',
      'en|vi:Fried banana': 'Chuối chiên',
      'vi|de:Chuối chiên': 'Gebratene Banane',
      'de|vi:Gebratene Banane': 'Chuối chiên',
    });

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
    fakeMyMemory({
      'en|vi:Fried banana': 'Chuối chiên',
      'vi|en:Chuối chiên': 'Fried banana',
      'en|de:Fried banana': 'Gebratene Banane',
      'de|en:Gebratene Banane': 'Fried banana',
    });

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

describe('food names: a wrong translation is worse than none', () => {
  beforeEach(() => {
    jest.mocked(addCustomFoodAndRegister).mockClear();
    useSettingsStore.setState({ autoTranslateCustomFoodNames: true });
  });
  afterEach(() => {
    useSettingsStore.setState({ autoTranslateCustomFoodNames: false, foodNameTranslationsCheckedV1: false });
  });

  it('a dish known by its own name ("Bánh nướng tàu") is never sent for translation', async () => {
    const calls = fakeMyMemory({});
    await autoTranslateCustomFoodName(customFood({ nameVi: 'Bánh nướng tàu' }), 'vi');
    expect(calls).toEqual([]);
    expect(addCustomFoodAndRegister).not.toHaveBeenCalled();
  });

  it('refuses a translation that does not survive the round trip', async () => {
    fakeMyMemory({
      'vi|en:Canh chua cá': 'howler sour soup',
      'en|vi:howler sour soup': 'canh chua cá hú',
    });
    expect(await translateFoodName('Canh chua cá', 'vi', 'en')).toBeNull();
    await autoTranslateCustomFoodName(customFood({ nameVi: 'Canh chua cá' }), 'vi');
    expect(addCustomFoodAndRegister).not.toHaveBeenCalled();
  });

  it('an echo, or Vietnamese letters in an English result, is not a translation', async () => {
    fakeMyMemory({ 'vi|en:Cơm gà': 'Cơm gà xối' });
    expect(await translateFoodName('Cơm gà', 'vi', 'en')).toBeNull();
    fakeMyMemory({});
    expect(await translateFoodName('Cơm gà', 'vi', 'en')).toBeNull();
  });

  it('Vietnamese typed while the app is in English is translated FROM Vietnamese', async () => {
    const calls = fakeMyMemory({
      'vi|en:Chuối chiên': 'Fried banana',
      'en|vi:Fried banana': 'Chuối chiên',
    });
    await autoTranslateCustomFoodName(customFood({ nameVi: 'Chuối chiên' }), 'en');
    expect(calls).toContain('vi|en:Chuối chiên');
    expect(calls.some((c) => c.startsWith('en|de:Chuối'))).toBe(false);
    expect(jest.mocked(addCustomFoodAndRegister).mock.calls[0][0]).toMatchObject({
      nameVi: 'Chuối chiên',
      nameEn: 'Fried banana',
    });
  });

  it('re-checks stored English names once: drops the ones that do not translate back', async () => {
    const good = customFood({ id: 'c1', nameVi: 'Chuối chiên', nameEn: 'Fried banana' });
    const bad = customFood({ id: 'c2', nameVi: 'Canh chua cá', nameEn: 'howler sour soup' });
    jest.mocked(getCustomFoods).mockReturnValue([good, bad]);
    jest.mocked(getCustomFoodByIdSync).mockImplementation((id) => (id === 'c2' ? bad : undefined));
    jest.mocked(getAllOverridesSync).mockReturnValue([{ ...bad, nameVi: 'Canh chua cá lóc' }]);
    fakeMyMemory({ 'en|vi:Fried banana': 'Chuối chiên', 'en|vi:howler sour soup': 'canh chua cá hú' });

    await recheckStoredFoodTranslations();

    expect(updateCustomFoodNamesAndRegister).toHaveBeenCalledTimes(1);
    expect(updateCustomFoodNamesAndRegister).toHaveBeenCalledWith('c2', 'Canh chua cá', '');
    expect(jest.mocked(upsertOverrideAndRegister).mock.calls[0][0]).toMatchObject({ id: 'c2', nameEn: '' });
    expect(useSettingsStore.getState().foodNameTranslationsCheckedV1).toBe(true);

    // Done once: a second start does nothing.
    jest.mocked(updateCustomFoodNamesAndRegister).mockClear();
    await recheckStoredFoodTranslations();
    expect(updateCustomFoodNamesAndRegister).not.toHaveBeenCalled();
  });

  it('offline: the re-check stops without marking itself done', async () => {
    jest.mocked(getCustomFoods).mockReturnValue([customFood({ nameVi: 'Canh chua cá', nameEn: 'howler sour soup' })]);
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await recheckStoredFoodTranslations();
    expect(useSettingsStore.getState().foodNameTranslationsCheckedV1).toBe(false);
  });
});
