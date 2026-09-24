import { decodePercentEncodedText, repairEncodedFoodNames } from '../foodNameText';
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
