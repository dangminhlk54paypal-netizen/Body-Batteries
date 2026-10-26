import type { ActivityType, LiftingExercise } from '../../../types/energy';

// Keywords the "Kể cả ngày" parser reads in a typed / dictated / pasted
// description of a workout — Vietnamese, English and German together, like
// mealTextLexicon.ts (whose foldWord and time words are reused). NEVER
// displayed, so these are not UI strings for i18n purposes: they only decide
// which activity a piece names and how its duration / steps / sets are said.
//
// Words are written accented (lower-cased, NFC). A token typed without
// Vietnamese accents still matches its folded form (see parseActivityText):
// a piece that says only a name ("chay", "bơ…") is checked against the food
// catalog before it becomes a workout (dayText/parseDayText.ts).

export interface ActivityPhrase {
  tokens: string[];
  type: ActivityType;
}

const p = (words: string, type: ActivityType): ActivityPhrase => ({ tokens: words.split(' '), type });

export const ACTIVITY_PHRASES: ActivityPhrase[] = [
  // walking
  p('đi bộ', 'walking'),
  p('đi dạo', 'walking'),
  p('tản bộ', 'walking'),
  p('walk', 'walking'),
  p('walked', 'walking'),
  p('walking', 'walking'),
  p('spazieren', 'walking'),
  p('spaziergang', 'walking'),
  p('gehen', 'walking'),
  // brisk walking (longer phrases win over "đi bộ" / "walk")
  p('đi bộ nhanh', 'brisk_walking'),
  p('đi nhanh', 'brisk_walking'),
  p('brisk walk', 'brisk_walking'),
  p('brisk walking', 'brisk_walking'),
  p('power walking', 'brisk_walking'),
  p('nordic walking', 'brisk_walking'),
  p('zügig gehen', 'brisk_walking'),
  // running
  p('chạy bộ', 'running'),
  p('chạy', 'running'),
  p('run', 'running'),
  p('ran', 'running'),
  p('running', 'running'),
  p('jog', 'running'),
  p('jogging', 'running'),
  p('joggen', 'running'),
  p('laufen', 'running'),
  p('gelaufen', 'running'),
  // cycling
  p('đạp xe', 'cycling'),
  p('xe đạp', 'cycling'),
  p('cycling', 'cycling'),
  p('bike', 'cycling'),
  p('biking', 'cycling'),
  p('radfahren', 'cycling'),
  p('rad gefahren', 'cycling'),
  p('fahrrad', 'cycling'),
  // elliptical
  p('máy elip', 'elliptical'),
  p('elip', 'elliptical'),
  p('elliptical', 'elliptical'),
  p('crosstrainer', 'elliptical'),
  p('cross trainer', 'elliptical'),
  // swimming
  p('bơi lội', 'swimming'),
  p('bơi', 'swimming'),
  p('swim', 'swimming'),
  p('swam', 'swimming'),
  p('swimming', 'swimming'),
  p('schwimmen', 'swimming'),
  p('geschwommen', 'swimming'),
  // sports
  p('đá bóng', 'football'),
  p('bóng đá', 'football'),
  p('đá banh', 'football'),
  p('football', 'football'),
  p('soccer', 'football'),
  p('futsal', 'football'),
  p('fußball', 'football'),
  p('bóng rổ', 'basketball'),
  p('basketball', 'basketball'),
  p('cầu lông', 'badminton'),
  p('đánh cầu', 'badminton'),
  p('badminton', 'badminton'),
  p('federball', 'badminton'),
  p('tennis', 'tennis'),
  p('quần vợt', 'tennis'),
  // gym by minutes (a muscle-group day, "the gym")
  p('gym', 'gym_strength'),
  p('tập tạ', 'gym_strength'),
  p('tập gym', 'gym_strength'),
  p('tập ngực', 'gym_strength'),
  p('tập lưng', 'gym_strength'),
  p('tập chân', 'gym_strength'),
  p('tập tay', 'gym_strength'),
  p('tập vai', 'gym_strength'),
  p('tập mông', 'gym_strength'),
  p('tập bụng', 'gym_strength'),
  p('weights', 'gym_strength'),
  p('weight training', 'gym_strength'),
  p('strength training', 'gym_strength'),
  p('lifting', 'gym_strength'),
  p('krafttraining', 'gym_strength'),
  p('fitnessstudio', 'gym_strength'),
  // others
  p('hiit', 'hiit'),
  p('tabata', 'hiit'),
  p('yoga', 'yoga'),
];

// The three barbell lifts, logged set-based like the Powerlifting sheet.
export const LIFT_PHRASES: { tokens: string[]; exercise: LiftingExercise }[] = [
  { tokens: ['squat'], exercise: 'squat' },
  { tokens: ['squats'], exercise: 'squat' },
  { tokens: ['gánh', 'đùi'], exercise: 'squat' },
  { tokens: ['gánh', 'tạ'], exercise: 'squat' },
  { tokens: ['kniebeuge'], exercise: 'squat' },
  { tokens: ['kniebeugen'], exercise: 'squat' },
  { tokens: ['bench'], exercise: 'bench_press' },
  { tokens: ['bench', 'press'], exercise: 'bench_press' },
  { tokens: ['đẩy', 'ngực'], exercise: 'bench_press' },
  { tokens: ['bankdrücken'], exercise: 'bench_press' },
  { tokens: ['deadlift'], exercise: 'deadlift' },
  { tokens: ['deadlifts'], exercise: 'deadlift' },
  { tokens: ['kéo', 'đất'], exercise: 'deadlift' },
  { tokens: ['kreuzheben'], exercise: 'deadlift' },
];

// ── Amount words ─────────────────────────────────────────────────────────

export const MINUTE_WORDS = new Set([
  'phút',
  'phut',
  'p',
  'ph',
  "'",
  'min',
  'mins',
  'minute',
  'minutes',
  'minuten',
]);

// Always a length of time.
export const HOUR_WORDS = new Set(['tiếng', 'tieng', 'hour', 'hours', 'hr', 'hrs', 'stunde', 'stunden', 'std']);

// A length of time OR a clock time ("chạy 1 giờ" / "lúc 6 giờ") — see
// parseActivityText.isClockHour.
export const CLOCK_OR_HOUR_WORDS = new Set(['giờ', 'gio', 'h']);

// "1 tiếng rưỡi" = 90 minutes; "anderthalb Stunden" too.
export const AND_A_HALF_WORDS = new Set(['rưỡi', 'ruoi']);
export const ONE_AND_A_HALF_WORDS = new Set(['anderthalb', 'eineinhalb']);

// Before a number, these make it a clock time.
export const CLOCK_MARKERS = new Set([
  'lúc',
  'luc',
  'vào',
  'vao',
  'từ',
  'tu',
  'đến',
  'den',
  'tới',
  'toi',
  'at',
  'from',
  'to',
  'until',
  'till',
  'um',
  'von',
  'bis',
  'ab',
]);

// Parts of the day next to a number make it a clock time ("6h sáng").
export const DAY_PART_WORDS = new Set([
  'sáng',
  'trưa',
  'chiều',
  'tối',
  'đêm',
  'khuya',
  'sang',
  'trua',
  'chieu',
  'am',
  'pm',
  'morning',
  'afternoon',
  'evening',
  'night',
  'morgens',
  'früh',
  'mittags',
  'nachmittags',
  'abends',
  'nachts',
]);

// Between two clock times: "6h đến 7h", "6-7h", "from 6 to 7", "von 6 bis 7".
export const RANGE_JOINERS = new Set(['đến', 'den', 'tới', 'toi', '-', '–', 'to', 'until', 'till', 'bis']);

export const STEP_WORDS = new Set(['bước', 'buoc', 'step', 'steps', 'schritt', 'schritte']);
// "8k bước", "8 nghìn bước", "8 tausend Schritte".
export const THOUSAND_WORDS = new Set(['k', 'nghìn', 'ngàn', 'nghin', 'ngan', 'thousand', 'tausend']);

export const KM_WORDS = new Set(['km', 'kilomet', 'kilometer', 'kilometers', 'kilometre', 'kilometres']);
export const KM_PHRASES = [['cây', 'số'], ['cay', 'so']];

export const SET_WORDS = new Set([
  'hiệp',
  'hiep',
  'set',
  'sets',
  'lượt',
  'luot',
  'round',
  'rounds',
  'satz',
  'sätze',
  'sätzen',
  'runde',
  'runden',
]);
export const REP_WORDS = new Set([
  'cái',
  'cai',
  'lần',
  'lan',
  'rep',
  'reps',
  'wdh',
  'wiederholung',
  'wiederholungen',
]);
export const KG_WORDS = new Set(['kg', 'kí', 'ký', 'ki', 'kgs', 'kilo', 'kilos']);

// Words around a workout that name nothing ("tập 30 phút", "went for a run").
// Accented Vietnamese only where folding would collide with a food word.
export const ACTIVITY_FILLER_WORDS = new Set([
  'tập',
  'tap',
  'đi',
  'di',
  'buổi',
  'buoi',
  'mỗi',
  'moi',
  'trong',
  'mất',
  'mat',
  'với',
  'được',
  'xong',
  'thêm',
  'nữa',
  'nua',
  'ở',
  'ngoài',
  'công',
  'viên',
  'nhà',
  'went',
  'go',
  'did',
  'do',
  'a',
  'an',
  'of',
  'in',
  'for',
  'the',
  'session',
  'workout',
  'training',
  'x',
  '@',
  'war',
  'bin',
  'ging',
  'gemacht',
  'lang',
  'eine',
  'einen',
  'für',
  'fur',
  'im',
  'mit',
  'à',
]);
