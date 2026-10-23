import type { MealType } from '../../../types/food';

// Keywords the "Nạp bằng chữ" parser reads in a typed / dictated / pasted
// meal description — Vietnamese, English and German together, because people
// mix them ("200g Hähnchen", "1 bowl phở") and a dictated or AI-written text
// may not be in the app's language. NEVER displayed, so these are not UI
// strings for i18n purposes (same status as foodSearchAliases.ts): they only
// decide how a sentence is cut into amount / unit / food / time.
//
// Two spellings per word where needed:
// - accented (lower-cased, NFC) — the safe default, because many Vietnamese
//   words collapse into each other once the tone marks go: tối/tôi → "toi",
//   năm/nắm → "nam", mười/muối → "muoi", sáu/sau → "sau";
// - folded (accent-free) — only for words that stay unambiguous without
//   accents ("hom qua", "chieu"), so people typing without a Vietnamese
//   keyboard are still understood.

// Strips accents the same way the food search does (foodSearch.normalize),
// kept local so the domain layer does not import the data layer.
export function foldWord(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss');
}

// ── Time words ────────────────────────────────────────────────────────────

export interface TimePhrase {
  tokens: string[];
  // Compare against folded tokens instead of accented ones.
  folded?: boolean;
  dayOffset?: number; // 0 = today, -1 = yesterday…
  meal?: MealType;
  // A fixed clock time for parts of the day that are not a meal window
  // ("chiều" → 15:30, "đêm" → 22:00).
  hour?: number;
  minute?: number;
}

const AFTERNOON = { meal: 'snack' as const, hour: 15, minute: 30 };
const NIGHT = { meal: 'snack' as const, hour: 22, minute: 0 };

// Longest phrases first so "tối qua" wins over "tối".
export const TIME_PHRASES: TimePhrase[] = [
  // Vietnamese, accented
  { tokens: ['hôm', 'kia'], dayOffset: -2 },
  { tokens: ['hôm', 'kìa'], dayOffset: -2 },
  { tokens: ['hôm', 'qua'], dayOffset: -1 },
  { tokens: ['hôm', 'nay'], dayOffset: 0 },
  { tokens: ['tối', 'qua'], dayOffset: -1, meal: 'dinner' },
  { tokens: ['đêm', 'qua'], dayOffset: -1, ...NIGHT },
  { tokens: ['sáng', 'nay'], dayOffset: 0, meal: 'breakfast' },
  { tokens: ['trưa', 'nay'], dayOffset: 0, meal: 'lunch' },
  { tokens: ['chiều', 'nay'], dayOffset: 0, ...AFTERNOON },
  { tokens: ['tối', 'nay'], dayOffset: 0, meal: 'dinner' },
  { tokens: ['bữa', 'sáng'], meal: 'breakfast' },
  { tokens: ['ăn', 'sáng'], meal: 'breakfast' },
  { tokens: ['bữa', 'trưa'], meal: 'lunch' },
  { tokens: ['ăn', 'trưa'], meal: 'lunch' },
  { tokens: ['bữa', 'chiều'], ...AFTERNOON },
  { tokens: ['bữa', 'tối'], meal: 'dinner' },
  { tokens: ['ăn', 'tối'], meal: 'dinner' },
  { tokens: ['bữa', 'phụ'], meal: 'snack' },
  { tokens: ['ăn', 'vặt'], meal: 'snack' },
  { tokens: ['ăn', 'nhẹ'], meal: 'snack' },
  { tokens: ['sáng'], meal: 'breakfast' },
  { tokens: ['trưa'], meal: 'lunch' },
  { tokens: ['chiều'], ...AFTERNOON },
  { tokens: ['tối'], meal: 'dinner' },
  { tokens: ['khuya'], ...NIGHT },
  { tokens: ['đêm'], ...NIGHT },
  // Vietnamese typed without accents — only the unambiguous ones
  { tokens: ['hom', 'kia'], folded: true, dayOffset: -2 },
  { tokens: ['hom', 'qua'], folded: true, dayOffset: -1 },
  { tokens: ['hom', 'nay'], folded: true, dayOffset: 0 },
  { tokens: ['toi', 'qua'], folded: true, dayOffset: -1, meal: 'dinner' },
  { tokens: ['sang', 'nay'], folded: true, dayOffset: 0, meal: 'breakfast' },
  { tokens: ['trua', 'nay'], folded: true, dayOffset: 0, meal: 'lunch' },
  { tokens: ['chieu', 'nay'], folded: true, dayOffset: 0, ...AFTERNOON },
  { tokens: ['toi', 'nay'], folded: true, dayOffset: 0, meal: 'dinner' },
  { tokens: ['bua', 'sang'], folded: true, meal: 'breakfast' },
  { tokens: ['an', 'sang'], folded: true, meal: 'breakfast' },
  { tokens: ['bua', 'trua'], folded: true, meal: 'lunch' },
  { tokens: ['an', 'trua'], folded: true, meal: 'lunch' },
  { tokens: ['bua', 'toi'], folded: true, meal: 'dinner' },
  { tokens: ['an', 'toi'], folded: true, meal: 'dinner' },
  { tokens: ['an', 'vat'], folded: true, meal: 'snack' },
  { tokens: ['trua'], folded: true, meal: 'lunch' },
  { tokens: ['chieu'], folded: true, ...AFTERNOON },
  { tokens: ['khuya'], folded: true, ...NIGHT },
  // English
  { tokens: ['last', 'night'], dayOffset: -1, meal: 'dinner' },
  { tokens: ['this', 'morning'], dayOffset: 0, meal: 'breakfast' },
  { tokens: ['yesterday'], dayOffset: -1 },
  { tokens: ['today'], dayOffset: 0 },
  { tokens: ['tonight'], dayOffset: 0, meal: 'dinner' },
  { tokens: ['breakfast'], meal: 'breakfast' },
  { tokens: ['morning'], meal: 'breakfast' },
  { tokens: ['lunch'], meal: 'lunch' },
  { tokens: ['noon'], meal: 'lunch' },
  { tokens: ['midday'], meal: 'lunch' },
  { tokens: ['afternoon'], ...AFTERNOON },
  { tokens: ['dinner'], meal: 'dinner' },
  { tokens: ['supper'], meal: 'dinner' },
  { tokens: ['evening'], meal: 'dinner' },
  { tokens: ['snack'], meal: 'snack' },
  { tokens: ['night'], ...NIGHT },
  // German (folded, so "Frühstück" / "Fruehstueck" / "Fruhstuck" all match)
  { tokens: ['heute', 'morgen'], folded: true, dayOffset: 0, meal: 'breakfast' },
  { tokens: ['gestern', 'abend'], folded: true, dayOffset: -1, meal: 'dinner' },
  { tokens: ['vorgestern'], folded: true, dayOffset: -2 },
  { tokens: ['gestern'], folded: true, dayOffset: -1 },
  { tokens: ['heute'], folded: true, dayOffset: 0 },
  { tokens: ['fruhstuck'], folded: true, meal: 'breakfast' },
  { tokens: ['fruehstueck'], folded: true, meal: 'breakfast' },
  { tokens: ['morgens'], folded: true, meal: 'breakfast' },
  { tokens: ['mittagessen'], folded: true, meal: 'lunch' },
  { tokens: ['mittags'], folded: true, meal: 'lunch' },
  { tokens: ['mittag'], folded: true, meal: 'lunch' },
  { tokens: ['nachmittags'], folded: true, ...AFTERNOON },
  { tokens: ['nachmittag'], folded: true, ...AFTERNOON },
  { tokens: ['abendessen'], folded: true, meal: 'dinner' },
  { tokens: ['abendbrot'], folded: true, meal: 'dinner' },
  { tokens: ['abends'], folded: true, meal: 'dinner' },
  { tokens: ['abend'], folded: true, meal: 'dinner' },
  { tokens: ['zwischenmahlzeit'], folded: true, meal: 'snack' },
  { tokens: ['nachts'], folded: true, ...NIGHT },
];

// ── Words that separate two foods ────────────────────────────────────────
// "cơm với trứng" / "Reis mit Hähnchen" become two rows — the user unticks a
// row that should not be there, which is easier than a food the parser never
// offered.
export const ITEM_CONNECTORS = [
  'và',
  'cùng',
  'với',
  'rồi',
  'and',
  'with',
  'plus',
  'then',
  'und',
  'mit',
  'dann',
  'sowie',
];

// ── Words that carry no food meaning ─────────────────────────────────────
// Vietnamese fillers are matched ACCENTED: folded, "tôi" (I) would also throw
// away "tỏi" (garlic), "đã" would eat "đá" (ice), "chừng" would eat "chưng"
// (bánh chưng). Only fillers that stay unambiguous without accents are in the
// folded list, together with the English and German ones.
export const FILLER_WORDS_ACCENTED = new Set([
  'tôi',
  'mình',
  'em',
  'anh',
  'chị',
  'ăn',
  'uống',
  'đã',
  'vừa',
  'mới',
  'có',
  'thêm',
  'bữa',
  'lúc',
  'vào',
  'khoảng',
  'tầm',
  'chừng',
  'được',
  'hết',
  'nay',
  'xong',
  'à',
  'ạ',
  'nhé',
]);

export const FILLER_WORDS_FOLDED = new Set([
  // vi typed without accents
  'minh',
  'uong',
  'them',
  'bua',
  'luc',
  'vao',
  'khoang',
  'duoc',
  'het',
  'xong',
  'nhe',
  // en
  'i',
  'ive',
  'ate',
  'eat',
  'eaten',
  'had',
  'have',
  'drank',
  'drink',
  'drunk',
  'for',
  'at',
  'about',
  'around',
  'some',
  'of',
  'my',
  'the',
  'just',
  'also',
  'approx',
  // de
  'ich',
  'habe',
  'hab',
  'hatte',
  'gegessen',
  'getrunken',
  'esse',
  'trinke',
  'zum',
  'zur',
  'um',
  'gegen',
  'etwa',
  'ca',
  'ungefahr',
  'etwas',
  'von',
  'noch',
  'auch',
]);

// ── Number words ─────────────────────────────────────────────────────────
// Accented keys. Consecutive number words multiply: "một nửa" = 1 × 0.5,
// "half a" = 0.5 × 1, "eine halbe" = 1 × 0.5.
export const NUMBER_WORDS: Record<string, number> = {
  // vi
  'một': 1,
  'hai': 2,
  'ba': 3,
  'bốn': 4,
  'năm': 5,
  'sáu': 6,
  'bảy': 7,
  'tám': 8,
  'chín': 9,
  'mười': 10,
  'nửa': 0.5,
  // vi without accents — only where the word means nothing else
  'mot': 1,
  'bon': 4,
  'nua': 0.5,
  // en
  'a': 1,
  'an': 1,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'half': 0.5,
  'couple': 2,
  // de
  'ein': 1,
  'eine': 1,
  'einen': 1,
  'einem': 1,
  'einer': 1,
  'zwei': 2,
  'drei': 3,
  'vier': 4,
  'fünf': 5,
  'funf': 5,
  'fuenf': 5,
  'sechs': 6,
  'sieben': 7,
  'acht': 8,
  'neun': 9,
  'zehn': 10,
  'halb': 0.5,
  'halbe': 0.5,
  'halben': 0.5,
  'halber': 0.5,
};

// "1 chén rưỡi" = 1.5 chén.
export const HALF_MORE_WORDS = new Set(['rưỡi', 'ruoi']);

// ── Units ────────────────────────────────────────────────────────────────

export type PortionGroup =
  | 'bowl'
  | 'plate'
  | 'cup'
  | 'piece'
  | 'pack'
  | 'spoon'
  | 'serving'
  | 'capsule'
  | 'loaf'
  | 'handful';

export type UnitWord =
  | { kind: 'mass'; gramsPer: number }
  | { kind: 'portion'; group: PortionGroup };

const mass = (gramsPer: number): UnitWord => ({ kind: 'mass', gramsPer });
const portion = (group: PortionGroup): UnitWord => ({ kind: 'portion', group });

// Accented keys (a folded lookup follows for the ones that survive folding).
// g and ml are both "grams" to the engine — it uses 1 ml ≈ 1 g throughout
// (see MeasureUnit in types/food.ts).
export const UNIT_WORDS: Record<string, UnitWord> = {
  g: mass(1),
  gr: mass(1),
  gram: mass(1),
  grams: mass(1),
  gam: mass(1),
  gramm: mass(1),
  kg: mass(1000),
  kilo: mass(1000),
  ml: mass(1),
  cl: mass(10),
  dl: mass(100),
  l: mass(1000),
  lít: mass(1000),
  lit: mass(1000),
  liter: mass(1000),
  litre: mass(1000),
  // vi
  chén: portion('bowl'),
  bát: portion('bowl'),
  tô: portion('bowl'),
  đĩa: portion('plate'),
  dĩa: portion('plate'),
  ly: portion('cup'),
  cốc: portion('cup'),
  tách: portion('cup'),
  cái: portion('piece'),
  chiếc: portion('piece'),
  quả: portion('piece'),
  trái: portion('piece'),
  miếng: portion('piece'),
  lát: portion('piece'),
  cuốn: portion('piece'),
  con: portion('piece'),
  củ: portion('piece'),
  bắp: portion('piece'),
  gói: portion('pack'),
  hộp: portion('pack'),
  chai: portion('pack'),
  lon: portion('pack'),
  thanh: portion('pack'),
  muỗng: portion('spoon'),
  thìa: portion('spoon'),
  phần: portion('serving'),
  suất: portion('serving'),
  viên: portion('capsule'),
  ổ: portion('loaf'),
  nắm: portion('handful'),
  // en
  bowl: portion('bowl'),
  bowls: portion('bowl'),
  plate: portion('plate'),
  plates: portion('plate'),
  cup: portion('cup'),
  cups: portion('cup'),
  glass: portion('cup'),
  glasses: portion('cup'),
  mug: portion('cup'),
  piece: portion('piece'),
  pieces: portion('piece'),
  slice: portion('piece'),
  slices: portion('piece'),
  pack: portion('pack'),
  packs: portion('pack'),
  box: portion('pack'),
  bottle: portion('pack'),
  bottles: portion('pack'),
  can: portion('pack'),
  cans: portion('pack'),
  bar: portion('pack'),
  spoon: portion('spoon'),
  spoons: portion('spoon'),
  tbsp: portion('spoon'),
  tsp: portion('spoon'),
  serving: portion('serving'),
  servings: portion('serving'),
  portion: portion('serving'),
  portions: portion('serving'),
  capsule: portion('capsule'),
  capsules: portion('capsule'),
  tablet: portion('capsule'),
  tablets: portion('capsule'),
  handful: portion('handful'),
  // de
  schüssel: portion('bowl'),
  schale: portion('bowl'),
  teller: portion('plate'),
  glas: portion('cup'),
  tasse: portion('cup'),
  becher: portion('cup'),
  stück: portion('piece'),
  stueck: portion('piece'),
  scheibe: portion('piece'),
  scheiben: portion('piece'),
  packung: portion('pack'),
  flasche: portion('pack'),
  dose: portion('pack'),
  riegel: portion('pack'),
  löffel: portion('spoon'),
  el: portion('spoon'),
  tl: portion('spoon'),
  kapsel: portion('capsule'),
  tablette: portion('capsule'),
  // "khẩu phần" is two words — see MULTI_WORD_UNITS.
};

// Folded spellings that are still unambiguous ("chen" can only be chén);
// "to" (tô), "nam" (nắm) and "o" (ổ) are left out on purpose.
export const FOLDED_UNIT_WORDS: Record<string, UnitWord> = {
  chen: portion('bowl'),
  bat: portion('bowl'),
  dia: portion('plate'),
  coc: portion('cup'),
  tach: portion('cup'),
  cai: portion('piece'),
  chiec: portion('piece'),
  qua: portion('piece'),
  trai: portion('piece'),
  mieng: portion('piece'),
  goi: portion('pack'),
  hop: portion('pack'),
  muong: portion('spoon'),
  thia: portion('spoon'),
  phan: portion('serving'),
  suat: portion('serving'),
  vien: portion('capsule'),
  schussel: portion('bowl'),
  stuck: portion('piece'),
  loffel: portion('spoon'),
  loeffel: portion('spoon'),
};

export const MULTI_WORD_UNITS: { tokens: string[]; unit: UnitWord }[] = [
  { tokens: ['khẩu', 'phần'], unit: portion('serving') },
  { tokens: ['khau', 'phan'], unit: portion('serving') },
];

// Container words that can open a phrase without a number ("tô phở", "a
// bowl of…" already has its "a") and then mean exactly one.
export const LEADING_UNIT_WORDS = new Set([
  'tô',
  'bát',
  'chén',
  'đĩa',
  'dĩa',
  'ly',
  'cốc',
  'tách',
  'ổ',
  'bowl',
  'plate',
  'glass',
  'cup',
  'schüssel',
  'teller',
  'glas',
  'tasse',
]);

// Size words that may follow a unit ("tô lớn", "large cup") — dropped, the
// preset or default serving decides the grams.
export const SIZE_WORDS = new Set([
  'lớn',
  'nhỏ',
  'to',
  'đầy',
  'vừa',
  'big',
  'small',
  'large',
  'medium',
  'full',
  'groß',
  'große',
  'großen',
  'grosse',
  'klein',
  'kleine',
  'kleinen',
  'voll',
  'volle',
]);

// Which portion group a serving-preset label belongs to ("tô lớn" → bowl),
// by its first word — so "1 tô phở" finds a "bát=…" preset and vice versa.
export function unitWordFor(word: string): UnitWord | undefined {
  const lower = word.toLowerCase();
  return UNIT_WORDS[lower] ?? FOLDED_UNIT_WORDS[foldWord(lower)];
}
