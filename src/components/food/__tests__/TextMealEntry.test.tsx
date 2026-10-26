import React from 'react';
import { Share, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { searchLibraryCandidates } from '../../../data/food/libraryFoodRegistry';
import { addCustomFoodAndRegister, setCustomFoods } from '../../../data/food/customFoodRegistry';
import { setOverrides, upsertOverrideAndRegister } from '../../../data/food/foodOverrideRegistry';
import TestRenderer, { act } from 'react-test-renderer';
import { TextMealEntry } from '../TextMealEntry';
import { useSettingsStore } from '../../../store/settingsStore';
import { useEnergyStore } from '../../../store/energyStore';
import { useMealTextDraftStore } from '../../../store/mealTextDraftStore';
import type { FoodLogEntry } from '../../../types/food';

// "Nạp bằng chữ": text → Phân tích → review rows → Nạp logs only the ticked,
// valid rows; a duplicate is explained and starts unticked; the typed text
// survives an accidental close for 5 minutes.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
// Saving AI numbers writes through the registries — kept in memory here.
jest.mock('../../../data/food/customFoodRegistry', () => {
  const actual = jest.requireActual('../../../data/food/customFoodRegistry');
  return {
    ...actual,
    addCustomFoodAndRegister: jest.fn(async (item) => actual.setCustomFoods([...actual.getCustomFoods(), item])),
  };
});
jest.mock('../../../data/food/foodOverrideRegistry', () => {
  const actual = jest.requireActual('../../../data/food/foodOverrideRegistry');
  return {
    ...actual,
    upsertOverrideAndRegister: jest.fn(async (item) =>
      actual.setOverrides([...actual.getAllOverridesSync().filter((o: { id: string }) => o.id !== item.id), item])
    ),
  };
});
jest.mock('../../../data/food/libraryFoodRegistry', () => ({
  ...jest.requireActual('../../../data/food/libraryFoodRegistry'),
  searchLibraryCandidates: jest.fn(async () => []),
}));

const NOW = new Date(2026, 9, 23, 13, 0).getTime(); // Fri 13:00
const TODAY = '2026-10-23';

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

// The innermost pressable whose text contains `label`.
function press(tree: TestRenderer.ReactTestRenderer, label: string) {
  const hits = tree.root.findAll(
    (n) => typeof n.type !== 'string' && typeof n.props.onPress === 'function' && textOf(n).includes(label)
  );
  if (hits.length === 0) throw new Error(`no button "${label}"`);
  const target = hits.reduce((a, b) => (textOf(b).length < textOf(a).length ? b : a));
  return act(async () => {
    await target.props.onPress();
  });
}

function typeText(tree: TestRenderer.ReactTestRenderer, text: string) {
  return act(async () => {
    tree.root.findAllByType(TextInput)[0].props.onChangeText(text);
  });
}

const logFood = jest.fn(async () => {});
const logFoodForPastDate = jest.fn(async () => {});
const mounted: TestRenderer.ReactTestRenderer[] = [];

async function render(recentLog: FoodLogEntry[] = [], onLogged = jest.fn(), onClose = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <TextMealEntry baseDate={TODAY} recentLog={recentLog} onBack={jest.fn()} onClose={onClose} onLogged={onLogged} />
    );
  });
  mounted.push(tree);
  return tree;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'vi' });
  useMealTextDraftStore.setState({ text: '', savedAt: 0 });
  logFood.mockClear();
  logFoodForPastDate.mockClear();
  useEnergyStore.setState({ logFood, logFoodForPastDate });
  jest.mocked(searchLibraryCandidates).mockResolvedValue([]);
  setCustomFoods([]);
  setOverrides([]);
  jest.mocked(addCustomFoodAndRegister).mockClear();
  jest.mocked(upsertOverrideAndRegister).mockClear();
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.useRealTimers();
});

describe('TextMealEntry', () => {
  it('reads a meal, shows the rows and logs them', async () => {
    const onLogged = jest.fn();
    const tree = await render([], onLogged);
    await typeText(tree, '2 chén cơm, 200g ức gà lúc 12h');
    await press(tree, 'Phân tích');

    const screen = textOf(tree.root);
    expect(screen).toContain('Cơm trắng');
    expect(screen).toContain('300g');
    expect(screen).toContain('Ức gà');
    expect(screen).toContain('Nạp 2 món');

    await press(tree, 'Nạp 2 món');
    const noon = new Date(2026, 9, 23, 12, 0).getTime();
    expect(logFood).toHaveBeenCalledTimes(2);
    expect(logFood).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'rice_white_cooked' }), 300, noon, undefined);
    expect(logFood).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'chicken_breast' }), 200, noon, undefined);
    expect(onLogged).toHaveBeenCalled();
    expect(useMealTextDraftStore.getState().text).toBe('');
  });

  it('explains a duplicate and leaves it unticked', async () => {
    const earlier: FoodLogEntry = {
      id: 'e1',
      timestamp: new Date(2026, 9, 23, 11, 30).getTime(),
      mealType: 'lunch',
      foodId: 'chicken_breast',
      foodNameVi: 'Ức gà',
      grams: 150,
      energyKcal: 248,
      proteinG: 46,
      fatG: 5,
      carbG: 0,
      waterG: 98,
      mineralsMg: 400,
    };
    const tree = await render([earlier]);
    await typeText(tree, '2 chén cơm, 200g ức gà');
    await press(tree, 'Phân tích');

    expect(textOf(tree.root)).toContain('Đã nạp Ức gà 150g lúc 11:30');
    expect(textOf(tree.root)).toContain('Nạp 1 món');
    await press(tree, 'Nạp 1 món');
    expect(logFood).toHaveBeenCalledTimes(1);
    expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ id: 'rice_white_cooked' }), 300, NOW, undefined);
  });

  it('never logs a food it could not find', async () => {
    const tree = await render();
    await typeText(tree, 'zzqx, 1 quả chuối');
    await press(tree, 'Phân tích');
    expect(textOf(tree.root)).toContain('Không có trong kho món');
    await press(tree, 'Nạp 1 món');
    expect(logFood).toHaveBeenCalledTimes(1);
    expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ id: 'banana' }), 120, NOW, undefined);
  });

  it('logs "hôm qua" onto yesterday through the backfill path', async () => {
    const tree = await render();
    await typeText(tree, 'hôm qua tối 1 tô bún bò huế');
    await press(tree, 'Phân tích');
    await press(tree, 'Nạp 1 món');
    expect(logFood).not.toHaveBeenCalled();
    expect(logFoodForPastDate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dish_bun_bo_hue' }),
      500,
      new Date(2026, 9, 22, 19, 0).getTime(),
      undefined
    );
  });

  it('keeps the typed text for 5 minutes, Huỷ clears it', async () => {
    useMealTextDraftStore.setState({ text: 'phở bò', savedAt: NOW - 60_000 });
    const onClose = jest.fn();
    const tree = await render([], jest.fn(), onClose);
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('phở bò');
    await press(tree, 'Huỷ');
    expect(onClose).toHaveBeenCalled();
    expect(useMealTextDraftStore.getState().text).toBe('');
  });

  it('drops a draft older than 5 minutes', async () => {
    useMealTextDraftStore.setState({ text: 'phở bò', savedAt: NOW - 6 * 60_000 });
    const tree = await render();
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('');
  });

  it('📋 Dán reads an AI answer from the clipboard and analyzes it', async () => {
    jest
      .mocked(Clipboard.getStringAsync)
      .mockResolvedValue('```json\n{"items":[{"name":"Cơm trắng","name_en":"White rice","grams":180}]}\n```');
    const tree = await render();
    await press(tree, '📋 Dán');
    expect(tree.root.findAllByType(TextInput)[0].props.value).toContain('"items"');
    expect(textOf(tree.root)).toContain('180g');
    await press(tree, 'Nạp 1 món');
    expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ id: 'rice_white_cooked' }), 180, NOW, undefined);
  });

  it('says so when the clipboard is empty', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('  ');
    const tree = await render();
    await press(tree, '📋 Dán');
    expect(textOf(tree.root)).toContain('Chưa có gì để dán');
  });

  it('📤 Hỏi AI shares the JSON prompt in the app language', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const tree = await render();
    await press(tree, '📤 Hỏi AI');
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('{"items":[{"name":') });
    expect(share.mock.calls[0][0]).toMatchObject({ message: expect.stringContaining('gram') });
    share.mockRestore();
  });

  it('finds a food from the user\'s imported tables ("Nguồn của tôi")', async () => {
    const quark = {
      id: 'lib_s1_magerquark',
      nameVi: 'Magerquark',
      nameEn: '',
      category: '',
      defaultServingG: 100,
      servingPresets: [],
      per100g: {
        energyKcal: 67,
        waterG: 0,
        proteinG: 12,
        fatG: 0.2,
        carbG: 4,
        fiberG: 0,
        sugarG: 4,
        calciumMg: 0,
        ironMg: 0,
        sodiumMg: 0,
        potassiumMg: 0,
        magnesiumMg: 0,
        zincMg: 0,
      },
      source: 'library',
      note: '',
    };
    jest.mocked(searchLibraryCandidates).mockImplementation(async (q: string) =>
      q.toLowerCase().includes('magerquark') ? [quark] : []
    );
    const tree = await render();
    await typeText(tree, '250g magerquark');
    await press(tree, 'Phân tích');
    await press(tree, 'Nạp 1 món');
    expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ id: 'lib_s1_magerquark' }), 250, NOW, undefined);
  });

  describe('nutrition from an AI', () => {
    it('saves an unknown dish as a new food with the AI numbers and logs it', async () => {
      jest
        .mocked(Clipboard.getStringAsync)
        .mockResolvedValue(
          '{"items":[{"name":"Bún đậu mắm tôm","name_en":"Tofu vermicelli","grams":350,"per_100g":{"kcal":160,"protein_g":8,"carbs_g":18,"fat_g":6}}]}'
        );
      const tree = await render();
      await press(tree, '📋 Dán');
      expect(textOf(tree.root)).toContain('Món mới 160 kcal/100g');
      await press(tree, 'Nạp 1 món');
      expect(addCustomFoodAndRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^custom_/),
          nameVi: 'Bún đậu mắm tôm',
          nameEn: 'Tofu vermicelli',
          per100g: expect.objectContaining({ energyKcal: 160, proteinG: 8, carbG: 18, fatG: 6 }),
        })
      );
      const saved = jest.mocked(addCustomFoodAndRegister).mock.calls[0][0];
      expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ id: saved.id }), 350, NOW, undefined);
    });

    it('keeps the app\'s numbers by default; "Số AI" updates the food, then logs it', async () => {
      jest
        .mocked(Clipboard.getStringAsync)
        .mockResolvedValue('{"items":[{"name":"Cơm trắng","grams":200,"per_100g":{"kcal":200,"protein_g":4,"carbs_g":44,"fat_g":1}}]}');
      const tree = await render();
      await press(tree, '📋 Dán');
      expect(textOf(tree.root)).toContain('đang dùng số app');
      await press(tree, '✎');
      expect(textOf(tree.root)).toContain('Dinh dưỡng /100g');
      await press(tree, 'Số AI');
      expect(textOf(tree.root)).toContain('Cập nhật');
      await press(tree, 'Xong');
      expect(textOf(tree.root)).toContain('Dùng số AI 200 kcal/100g');
      await press(tree, 'Nạp 1 món');
      expect(addCustomFoodAndRegister).not.toHaveBeenCalled();
      expect(upsertOverrideAndRegister).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rice_white_cooked', per100g: expect.objectContaining({ energyKcal: 200, carbG: 44 }) })
      );
      expect(logFood).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rice_white_cooked', per100g: expect.objectContaining({ energyKcal: 200 }) }),
        200,
        NOW,
        undefined
      );
    });

    it('💾 saves a pasted text analysis without logging it', async () => {
      jest
        .mocked(Clipboard.getStringAsync)
        .mockResolvedValue('Tên món: Chè bưởi\nKhẩu phần: 250 g\nCalories: 300 kcal\nProtein: 3 g\nCarbs: 62 g\nFat: 4 g');
      const tree = await render();
      await press(tree, '📋 Dán');
      await press(tree, '💾 Lưu 1 món');
      expect(addCustomFoodAndRegister).toHaveBeenCalledWith(
        expect.objectContaining({ nameVi: 'Chè bưởi', per100g: expect.objectContaining({ energyKcal: 120, carbG: 24.8 }) })
      );
      expect(logFood).not.toHaveBeenCalled();
      expect(textOf(tree.root)).not.toContain('💾');
      // The row now logs the saved food — nothing is saved twice.
      await press(tree, 'Nạp 1 món');
      expect(addCustomFoodAndRegister).toHaveBeenCalledTimes(1);
      expect(logFood).toHaveBeenCalledWith(expect.objectContaining({ nameVi: 'Chè bưởi' }), 250, NOW, undefined);
    });
  });
});
