import {
  acceptNameTranslation,
  decodePercentEncodedText,
  detectNameLanguage,
  isKeepAsIsName,
  namesAfterRename,
  repairEncodedFoodNames,
  repairStoredTranslations,
  sameNameLoosely,
} from '../foodNameText';
import type { FoodItem } from '../../../types/food';

describe('decodePercentEncodedText', () => {
  it('decodes a URL-encoded name echoed back by the translation API', () => {
    expect(decodePercentEncodedText('Fischst%C3%A4bchen%20Berida')).toBe('Fischstäbchen Berida');
    expect(decodePercentEncodedText('Tintefischringe%20im%20Backteig')).toBe(
      'Tintefischringe im Backteig'
    );
  });

  it("treats '+' as a space inside an encoded string", () => {
    expect(decodePercentEncodedText('Gr%C3%BCner+Tee')).toBe('Grüner Tee');
  });

  it('leaves normal typed names untouched', () => {
    expect(decodePercentEncodedText('Fischstäbchen Berida')).toBe('Fischstäbchen Berida');
    expect(decodePercentEncodedText('Vitamin D3+K2')).toBe('Vitamin D3+K2');
    expect(decodePercentEncodedText('Sữa 1.5%')).toBe('Sữa 1.5%');
    expect(decodePercentEncodedText('Quark 40%Fett')).toBe('Quark 40%Fett');
  });

  it('leaves text with raw spaces untouched even if it contains an escape', () => {
    expect(decodePercentEncodedText('Protein %2B Carb')).toBe('Protein %2B Carb');
  });

  it('returns the original on a malformed escape sequence', () => {
    expect(decodePercentEncodedText('Bad%C3%28')).toBe('Bad%C3%28');
  });
});

describe('repairEncodedFoodNames', () => {
  const base = {
    id: 'custom_1',
    nameVi: 'Fischstäbchen Berida',
    nameEn: 'Fischst%C3%A4bchen%20Berida',
    category: 'custom',
    defaultServingG: 100,
    servingPresets: [],
    per100g: {} as FoodItem['per100g'],
    source: 'custom',
    note: '',
  } as FoodItem;

  it('returns a fixed copy when a name was encoded', () => {
    expect(repairEncodedFoodNames(base)).toEqual({ ...base, nameEn: 'Fischstäbchen Berida' });
  });

  it('returns null when nothing needs repair', () => {
    expect(repairEncodedFoodNames({ ...base, nameEn: 'Fish sticks' })).toBeNull();
  });
});

describe('machine-translated food names', () => {
  const food = (patch: Partial<FoodItem>) =>
    ({
      id: 'custom_1',
      nameVi: 'Bánh nướng tàu',
      nameEn: 'Train pies',
      category: 'custom',
      defaultServingG: 100,
      servingPresets: [],
      per100g: {} as FoodItem['per100g'],
      source: 'custom',
      note: '',
      ...patch,
    }) as FoodItem;

  it('detects the language a name is written in, not the app’s', () => {
    expect(detectNameLanguage('Bánh nướng tàu', 'en')).toBe('vi');
    expect(detectNameLanguage('Fischstäbchen Berida', 'vi')).toBe('de');
    expect(detectNameLanguage('Chicken nuggets', 'en')).toBe('en');
    // à/é alone are not Vietnamese-only.
    expect(detectNameLanguage('Café crème', 'en')).toBe('en');
  });

  it('keeps Vietnamese dishes known by their own name', () => {
    expect(isKeepAsIsName('Bánh nướng tàu')).toBe(true);
    expect(isKeepAsIsName('bún bò Huế')).toBe(true);
    expect(isKeepAsIsName('Phở')).toBe(true);
    expect(isKeepAsIsName('Chuối chiên')).toBe(false);
    // Whole words only: "Chảo" is not "chả".
    expect(isKeepAsIsName('Chảo gang')).toBe(false);
  });

  it('accepts a translation only when it comes back as the same name', () => {
    const base = { source: 'Chuối chiên', target: 'en' as const, translated: 'Fried bananas' };
    expect(acceptNameTranslation({ ...base, backTranslated: 'chuối chiên.' })).toBe('Fried bananas');
    expect(acceptNameTranslation({ ...base, backTranslated: 'Chuối rán giòn' })).toBeNull();
    expect(acceptNameTranslation({ ...base, backTranslated: null })).toBeNull();
    expect(acceptNameTranslation({ ...base, translated: 'Chuối chiên', backTranslated: 'Chuối chiên' })).toBeNull();
    // A mangled echo (Vietnamese letters left in an English result).
    expect(acceptNameTranslation({ ...base, translated: 'Chuối n Schöpng', backTranslated: 'Chuối chiên' })).toBeNull();
    expect(sameNameLoosely('2.Xôi gấc', 'Xôi gấc')).toBe(true);
  });

  it('repairs stored names: a kept dish and a Vietnamese-lettered English name go back to one name', () => {
    expect(repairStoredTranslations(food({}))).toMatchObject({ nameVi: 'Bánh nướng tàu', nameEn: '' });
    // Typed in Vietnamese while the app was English: the Vietnamese text sat in nameEn.
    expect(repairStoredTranslations(food({ nameVi: 'Thit kho', nameEn: 'Thịt kho trứng' }))).toMatchObject({
      nameVi: 'Thịt kho trứng',
      nameEn: '',
    });
    expect(repairStoredTranslations(food({ nameVi: 'Chuối chiên', nameEn: 'Fried banana' }))).toBeNull();
    expect(repairStoredTranslations(food({ nameEn: '' }))).toBeNull();
  });

  it('renaming a custom food drops its old translations; a catalog food keeps its English name', () => {
    const custom = food({ nameVi: 'Chuối chiên', nameEn: 'Fried banana' });
    expect(namesAfterRename(custom, 'Chuối nướng')).toEqual({ nameVi: 'Chuối nướng', nameEn: '', nameDe: undefined });
    expect(namesAfterRename(custom, 'chuối chiên')).toMatchObject({ nameEn: 'Fried banana' });
    expect(namesAfterRename({ ...custom, source: 'USDA' }, 'Chuối nướng')).toMatchObject({ nameEn: 'Fried banana' });
  });
});
