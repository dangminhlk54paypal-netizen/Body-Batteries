import { buildActivityNames, decodeActivityPiece } from '../parseActivityText';
import type { CustomActivity, CustomExercise } from '../../../../types/energy';

// "Kể cả ngày", Decoding for workouts: what was done, how long, steps, sets,
// and the time words — with durations taken out before the clock is read.
const names = buildActivityNames();
const decode = (text: string) => decodeActivityPiece(text, names);

describe('decodeActivityPiece', () => {
  it('reads an activity, its minutes and the clock time', () => {
    const d = decode('sáng 6h chạy bộ 30 phút');
    expect(d?.match).toEqual({ kind: 'type', type: 'running' });
    expect(d?.minutes).toBe(30);
    expect(d?.time).toMatchObject({ hour: 6, minute: 0, meal: 'breakfast' });
  });

  it.each([
    ['chạy 1 giờ', 60],
    ['chạy 1h', 60],
    ['chạy 1 giờ 20 phút', 80],
    ['đạp xe 1h30', 90],
    ['tối tập gym 1 tiếng rưỡi', 90],
    ['eine halbe stunde yoga', 30],
    ['anderthalb Stunden Fußball', 90],
    ['joggen 45 Minuten', 45],
    ['ran for 25 minutes', 25],
    ['chay bo 30p', 30],
  ])('"%s" lasts %i minutes', (text, minutes) => {
    expect(decode(text)?.minutes).toBe(minutes);
  });

  it('keeps "lúc 6 giờ" / "6h sáng" as a clock time, not a length', () => {
    const d = decode('lúc 6 giờ chạy 45 phút');
    expect(d?.minutes).toBe(45);
    expect(d?.time).toMatchObject({ hour: 6, minute: 0 });
    expect(decode('6h sáng chạy bộ')?.minutes).toBeNull();
  });

  it('reads a clock range as the start time and the length', () => {
    const d = decode('từ 17h đến 18h30 đá bóng');
    expect(d?.match).toEqual({ kind: 'type', type: 'football' });
    expect(d).toMatchObject({ minutes: 90, fromRange: true });
    expect(d?.time).toMatchObject({ hour: 17, minute: 0 });
    expect(decode('6-7h sáng đạp xe')).toMatchObject({ minutes: 60, fromRange: true });
    expect(decode('11h-1h đá bóng')?.minutes).toBe(120);
  });

  it('reads steps, with thousands written several ways', () => {
    expect(decode('đi bộ 8000 bước')).toMatchObject({ steps: 8000, match: { kind: 'type', type: 'walking' } });
    expect(decode('đi bộ 8.000 bước')?.steps).toBe(8000);
    expect(decode('8k bước')?.steps).toBe(8000);
    expect(decode('10 nghìn bước')?.steps).toBe(10000);
    expect(decode('8000 Schritte')?.steps).toBe(8000);
  });

  it('reads a distance ("5km", a runner\'s "5k")', () => {
    expect(decode('chạy 5km trong 30 phút')).toMatchObject({ distanceKm: 5, minutes: 30 });
    expect(decode('ran 5k in 28 minutes')).toMatchObject({ distanceKm: 5, minutes: 28 });
  });

  it('reads sets for a barbell lift', () => {
    const d = decode('squat 5x5 100kg');
    expect(d?.match).toEqual({ kind: 'lift', exercise: 'squat' });
    expect(d?.sets).toHaveLength(5);
    expect(d?.sets?.[0]).toEqual({ kind: 'working', reps: 5, weightKg: 100 });
    expect(decode('squat 5x5x100kg')?.sets).toHaveLength(5);
    expect(decode('squat 5x5@100')?.sets?.[0].weightKg).toBe(100);
    expect(decode('deadlift 180kg')?.sets).toEqual([{ kind: 'working', reps: 1, weightKg: 180 }]);
  });

  it('reads sets said in words', () => {
    const d = decode('đẩy ngực 4 hiệp 12 cái 30kg');
    expect(d?.match).toEqual({ kind: 'lift', exercise: 'bench_press' });
    expect(d?.sets).toHaveLength(4);
    expect(d?.sets?.[0]).toMatchObject({ reps: 12, weightKg: 30 });
    expect(decode('3 sets of 10 lat pulldown 50kg')?.sets).toHaveLength(3);
  });

  it('finds bodybuilding exercises in all three languages, the longest name first', () => {
    expect(decode('kéo xô 4x12 40kg')?.match).toEqual({ kind: 'bodybuilding', exerciseId: 'lat_pulldown' });
    expect(decode('hít xà 3x10')?.match).toEqual({ kind: 'bodybuilding', exerciseId: 'pull_up' });
    expect(decode('Latzug 3x10 40kg')?.match).toEqual({ kind: 'bodybuilding', exerciseId: 'lat_pulldown' });
    // "goblet squat" beats "squat", "đẩy ngực tạ đơn" beats "đẩy ngực".
    expect(decode('goblet squat 3x12 16kg')?.match).toEqual({ kind: 'bodybuilding', exerciseId: 'goblet_squat' });
    expect(decode('đẩy ngực tạ đơn 3x10 20kg')?.match).toEqual({
      kind: 'bodybuilding',
      exerciseId: 'dumbbell_bench_press',
    });
    // Bodyweight sets have no weight.
    expect(decode('hít xà 3x10')?.sets?.[0].weightKg).toBe(0);
  });

  it('with sets said, a lift wins over a "tập gym" heading', () => {
    expect(decode('chiều tập gym: squat 5x5 100kg')?.match).toEqual({ kind: 'lift', exercise: 'squat' });
  });

  it('knows the user\'s own activities and exercises', () => {
    const custom: CustomActivity[] = [{ id: 'custom_1', nameVi: 'Leo núi', category: 'other', met: 7 }];
    const exercises: CustomExercise[] = [{ id: 'bbx_1', nameVi: 'Đẩy vai máy', muscle: 'shoulders', tier: 'compound' }];
    const own = buildActivityNames(custom, exercises);
    expect(decodeActivityPiece('leo núi 2 tiếng', own)?.match).toEqual({ kind: 'custom', id: 'custom_1' });
    expect(decodeActivityPiece('đẩy vai máy 3x12 30kg', own)?.match).toEqual({
      kind: 'bodybuilding',
      exerciseId: 'bbx_1',
    });
  });

  it('keeps a length with no known name, so the user can pick the activity', () => {
    const d = decode('leo núi 2 tiếng');
    expect(d).toMatchObject({ match: null, name: 'leo núi', minutes: 120 });
  });

  it('marks a piece that only said a name, with the extra words kept', () => {
    expect(decode('gà chạy bộ')).toMatchObject({ keywordOnly: true, extra: 'gà' });
    expect(decode('chạy bộ')).toMatchObject({ keywordOnly: true, extra: '' });
    expect(decode('chạy bộ 30 phút')?.keywordOnly).toBe(false);
  });

  it('is not a workout when nothing about one is said', () => {
    expect(decode('phở bò')).toBeNull();
    expect(decode('2 chén cơm')).toBeNull();
    expect(decode('200g ức gà lúc 12h')).toBeNull();
  });
});
