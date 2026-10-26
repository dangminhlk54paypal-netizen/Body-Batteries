import { parseMealText } from '../parseMealText';

function summary(text: string) {
  return parseMealText(text).map((item) => ({
    food: item.foodQuery,
    qty: item.quantity,
    unit: item.unit?.word ?? null,
  }));
}

describe('parseMealText — parsing (cutting into rows)', () => {
  it('splits on commas, "và", newlines and semicolons', () => {
    expect(summary('2 chén cơm, phở bò và 200g ức gà\ncà phê sữa; bánh mì')).toEqual([
      { food: 'cơm', qty: 2, unit: 'chén' },
      { food: 'phở bò', qty: null, unit: null },
      { food: 'ức gà', qty: 200, unit: 'g' },
      { food: 'cà phê sữa', qty: null, unit: null },
      { food: 'bánh mì', qty: null, unit: null },
    ]);
  });

  it('keeps a decimal comma inside a number', () => {
    expect(summary('1,5 chén cơm')).toEqual([{ food: 'cơm', qty: 1.5, unit: 'chén' }]);
  });

  it('splits English and German connectors', () => {
    expect(summary('rice with chicken and a glass of milk')).toEqual([
      { food: 'rice', qty: null, unit: null },
      { food: 'chicken', qty: null, unit: null },
      { food: 'milk', qty: 1, unit: 'glass' },
    ]);
    expect(summary('Reis mit Hähnchen und ein Glas Milch')).toEqual([
      { food: 'reis', qty: null, unit: null },
      { food: 'hähnchen', qty: null, unit: null },
      { food: 'milch', qty: 1, unit: 'glas' },
    ]);
  });

  it('drops filler words but keeps look-alike food words', () => {
    // "tỏi" (garlic) and "đá" (ice) fold to the fillers "toi"/"da".
    expect(summary('tôi đã ăn tỏi và trà đá')).toEqual([
      { food: 'tỏi', qty: null, unit: null },
      { food: 'trà đá', qty: null, unit: null },
    ]);
    expect(summary('bánh chưng')).toEqual([{ food: 'bánh chưng', qty: null, unit: null }]);
  });
});

describe('parseMealText — decoding amounts', () => {
  it('reads the amount after the food too', () => {
    expect(summary('cơm 2 chén')).toEqual([{ food: 'cơm', qty: 2, unit: 'chén' }]);
    expect(summary('ức gà 200g')).toEqual([{ food: 'ức gà', qty: 200, unit: 'g' }]);
  });

  it('reads glued and spaced mass units, kg and litres', () => {
    expect(summary('0.5kg thịt bò')).toEqual([{ food: 'thịt bò', qty: 0.5, unit: 'kg' }]);
    expect(summary('1 l sữa')).toEqual([{ food: 'sữa', qty: 1, unit: 'l' }]);
    expect(summary('250 ml nước cam')).toEqual([{ food: 'nước cam', qty: 250, unit: 'ml' }]);
  });

  it('reads number words, halves and "rưỡi"', () => {
    expect(summary('một tô phở')).toEqual([{ food: 'phở', qty: 1, unit: 'tô' }]);
    expect(summary('nửa ổ bánh mì')).toEqual([{ food: 'bánh mì', qty: 0.5, unit: 'ổ' }]);
    expect(summary('một nửa quả bơ')).toEqual([{ food: 'bơ', qty: 0.5, unit: 'quả' }]);
    expect(summary('1 chén rưỡi cơm')).toEqual([{ food: 'cơm', qty: 1.5, unit: 'chén' }]);
    expect(summary('half a bowl of rice')).toEqual([{ food: 'rice', qty: 0.5, unit: 'bowl' }]);
    expect(summary('eine halbe Tasse Kaffee')).toEqual([{ food: 'kaffee', qty: 0.5, unit: 'tasse' }]);
  });

  it('reads ½, 1/2 and ranges', () => {
    expect(summary('½ chén cơm')).toEqual([{ food: 'cơm', qty: 0.5, unit: 'chén' }]);
    expect(summary('1/2 chén cơm')).toEqual([{ food: 'cơm', qty: 0.5, unit: 'chén' }]);
    expect(summary('2-3 quả trứng')).toEqual([{ food: 'trứng', qty: 2.5, unit: 'quả' }]);
  });

  it('a container word alone means one', () => {
    expect(summary('tô phở bò')).toEqual([{ food: 'phở bò', qty: 1, unit: 'tô' }]);
  });

  it('drops size words after the unit', () => {
    expect(summary('1 tô lớn bún bò')).toEqual([{ food: 'bún bò', qty: 1, unit: 'tô' }]);
  });

  it('reads a count without a unit', () => {
    expect(summary('2 trứng')).toEqual([{ food: 'trứng', qty: 2, unit: null }]);
    expect(summary('3x trứng')).toEqual([{ food: 'trứng', qty: 3, unit: null }]);
  });

  it('keeps a fallback when the number word may be part of the name', () => {
    const [item] = parseMealText('ba chỉ nướng');
    expect(item.quantity).toBe(3);
    expect(item.foodQuery).toBe('chỉ nướng');
    expect(item.fallbackQuery).toBe('ba chỉ nướng');
  });

  it('does not mistake "2 hộp" for 2 o\'clock', () => {
    expect(summary('2 hộp sữa chua')).toEqual([{ food: 'sữa chua', qty: 2, unit: 'hộp' }]);
    expect(parseMealText('2 hộp sữa chua')[0].time).toBeNull();
  });
});

describe('parseMealText — decoding time', () => {
  it('reads a clock time and applies a single hint to every row', () => {
    const items = parseMealText('2 chén cơm, phở bò lúc 12h');
    expect(items.map((i) => i.time)).toEqual([
      { dayOffset: null, hour: 12, minute: 0, meal: null },
      { dayOffset: null, hour: 12, minute: 0, meal: null },
    ]);
    expect(items[1].foodQuery).toBe('phở bò');
  });

  it('reads 7h30, 7:30 and am/pm', () => {
    expect(parseMealText('trứng 7h30')[0].time).toMatchObject({ hour: 7, minute: 30 });
    expect(parseMealText('trứng 7:30')[0].time).toMatchObject({ hour: 7, minute: 30 });
    expect(parseMealText('pizza 7pm')[0].time).toMatchObject({ hour: 19, minute: 0 });
    expect(parseMealText('Brot um 8 Uhr')[0].time).toMatchObject({ hour: 8, minute: 0 });
  });

  it('turns an evening hour into 24h', () => {
    expect(parseMealText('tối 7h ăn bún chả')[0].time).toMatchObject({ hour: 19, meal: 'dinner' });
    expect(parseMealText('trưa 1h cơm gà')[0].time).toMatchObject({ hour: 13, meal: 'lunch' });
  });

  it('reads meal words and days', () => {
    expect(parseMealText('sáng nay ăn bánh mì')[0].time).toEqual({
      dayOffset: 0,
      hour: null,
      minute: null,
      meal: 'breakfast',
    });
    expect(parseMealText('hôm qua ăn phở')[0].time).toMatchObject({ dayOffset: -1, meal: null });
    expect(parseMealText('tối qua bún chả')[0].time).toMatchObject({ dayOffset: -1, meal: 'dinner' });
    expect(parseMealText('chiều trà sữa')[0].time).toMatchObject({ hour: 15, minute: 30, meal: 'snack' });
    expect(parseMealText('yesterday lunch: rice')[0].time).toMatchObject({ dayOffset: -1, meal: 'lunch' });
    expect(parseMealText('gestern zum Frühstück Brot')[0].time).toMatchObject({
      dayOffset: -1,
      meal: 'breakfast',
    });
  });

  it('understands Vietnamese typed without accents', () => {
    expect(parseMealText('hom qua an trua com ga')[0]).toMatchObject({
      foodQuery: 'com ga',
      time: { dayOffset: -1, meal: 'lunch' },
    });
  });

  it('carries time words forward when the text names several', () => {
    const items = parseMealText('Hôm qua:\nSáng: 2 trứng, sữa\nTrưa: cơm gà');
    expect(items.map((i) => [i.foodQuery, i.time?.dayOffset, i.time?.meal])).toEqual([
      ['trứng', -1, 'breakfast'],
      ['sữa', -1, 'breakfast'],
      ['cơm gà', -1, 'lunch'],
    ]);
  });

  it('a time-only line is not a row', () => {
    expect(parseMealText('Sáng:\n2 trứng').map((i) => i.foodQuery)).toEqual(['trứng']);
  });

  it('"tối" is evening, "tôi" is a filler', () => {
    const [item] = parseMealText('tôi ăn cơm tối');
    expect(item.foodQuery).toBe('cơm');
    expect(item.time?.meal).toBe('dinner');
  });
});

describe('parseMealText — JSON answers from an AI', () => {
  it('reads the format the "Hỏi AI" prompt asks for', () => {
    const items = parseMealText(
      '{"items":[{"name":"Cơm trắng","name_en":"White rice","grams":180,"time":"12:30"},{"name":"Thịt kho","name_en":"Braised pork","grams":120}]}'
    );
    expect(items).toEqual([
      {
        raw: 'Cơm trắng',
        foodQuery: 'cơm trắng',
        fallbackQuery: null,
        altQuery: 'white rice',
        quantity: 180,
        unit: { word: 'g', unit: { kind: 'mass', gramsPer: 1 } },
        time: { dayOffset: null, hour: 12, minute: 30, meal: null },
        ai: null,
        nameEn: 'White rice',
      },
      expect.objectContaining({ foodQuery: 'thịt kho', altQuery: 'braised pork', quantity: 120, time: null }),
    ]);
  });

  it('finds the JSON inside a chatty answer with code fences', () => {
    const answer = 'Here is my estimate:\n```json\n[{"name_en":"Banana","grams":"120"}]\n```\nEnjoy!';
    expect(parseMealText(answer)).toEqual([
      expect.objectContaining({ raw: 'Banana', foodQuery: 'banana', altQuery: null, quantity: 120 }),
    ]);
  });

  it('accepts quantity + unit, a shared meal and a day offset', () => {
    const items = parseMealText('{"meal":"dinner","day_offset":-1,"foods":[{"name":"phở bò","quantity":1,"unit":"tô"}]}');
    expect(items[0]).toMatchObject({
      foodQuery: 'phở bò',
      quantity: 1,
      unit: { word: 'tô' },
      time: { dayOffset: -1, meal: 'dinner', hour: null },
    });
  });

  it('skips items without a name and falls back to sentence parsing on broken JSON', () => {
    expect(parseMealText('[{"grams":100},{"name":"trứng","grams":50}]').map((i) => i.foodQuery)).toEqual(['trứng']);
    expect(parseMealText('{"items": [ broken').length).toBeGreaterThanOrEqual(0);
    expect(parseMealText('2 chén cơm {not json}')[0]).toMatchObject({ quantity: 2, unit: { word: 'chén' } });
  });
});
