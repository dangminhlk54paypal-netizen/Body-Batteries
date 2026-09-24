import {
  buildWeightChartModel,
  pickWeightChartTarget,
  filterWeightEntriesByRange,
  type WeightChartLayout,
} from '../weightChartModel';

const LAYOUT: WeightChartLayout = {
  width: 320,
  height: 180,
  padLeft: 30,
  padRight: 40,
  padTop: 10,
  padBottom: 20,
};
const at = (iso: string) => new Date(iso).getTime();
// 168 cm → healthy range 52.2–70.3 kg (BMI 18.5–24.9).
const HEIGHT = 168;
const HEALTHY_MAX = 24.9 * 1.68 * 1.68;

describe('buildWeightChartModel', () => {
  it('returns null with no entries', () => {
    expect(buildWeightChartModel([], HEIGHT, LAYOUT)).toBeNull();
  });

  it('places reference lines at the healthy upper bound + 0/10/20/35 kg', () => {
    const model = buildWeightChartModel(
      [
        { timestamp: at('2026-06-01T08:00:00'), value: 95 },
        { timestamp: at('2026-07-01T08:00:00'), value: 100 },
      ],
      HEIGHT,
      LAYOUT
    )!;
    const kgs = Object.fromEntries(model.refLines.map((r) => [r.kind, r.kg]));
    expect(kgs.healthy).toBeCloseTo(HEALTHY_MAX, 5);
    expect(kgs.plus10).toBeCloseTo(HEALTHY_MAX + 10, 5);
    expect(kgs.plus20).toBeCloseTo(HEALTHY_MAX + 20, 5);
    // 100 kg is below +35 (≈105.3) → it is the next threshold, so it shows too.
    expect(kgs.plus35).toBeCloseTo(HEALTHY_MAX + 35, 5);
  });

  it('shows only up to the next line above the highest reading', () => {
    const model = buildWeightChartModel(
      [
        { timestamp: at('2026-06-01T08:00:00'), value: 76 },
        { timestamp: at('2026-07-01T08:00:00'), value: 78 },
      ],
      HEIGHT,
      LAYOUT
    )!;
    expect(model.refLines.map((r) => r.kind)).toEqual(['healthy', 'plus10']);
  });

  it('maps heavier readings higher on screen and time left → right', () => {
    const model = buildWeightChartModel(
      [
        { timestamp: at('2026-07-01T08:00:00'), value: 80 },
        { timestamp: at('2026-06-01T08:00:00'), value: 70 },
      ],
      HEIGHT,
      LAYOUT
    )!;
    const [first, last] = model.points;
    expect(first.value).toBe(70);
    expect(first.x).toBe(LAYOUT.padLeft);
    expect(last.x).toBe(LAYOUT.width - LAYOUT.padRight);
    expect(last.y).toBeLessThan(first.y);
  });

  it('centres a single reading and still draws the healthy line', () => {
    const model = buildWeightChartModel([{ timestamp: at('2026-07-01T08:00:00'), value: 65 }], HEIGHT, LAYOUT)!;
    expect(model.points[0].x).toBe((LAYOUT.padLeft + LAYOUT.width - LAYOUT.padRight) / 2);
    expect(model.refLines.map((r) => r.kind)).toContain('healthy');
    expect(model.healthyBand).not.toBeNull();
  });

  it('keeps every tick and reference line inside the plot area', () => {
    const model = buildWeightChartModel(
      [
        { timestamp: at('2026-06-01T08:00:00'), value: 60 },
        { timestamp: at('2026-07-01T08:00:00'), value: 110 },
      ],
      HEIGHT,
      LAYOUT
    )!;
    for (const v of [...model.ticks, ...model.refLines]) {
      expect(v.y).toBeGreaterThanOrEqual(LAYOUT.padTop);
      expect(v.y).toBeLessThanOrEqual(LAYOUT.height - LAYOUT.padBottom);
    }
    expect(model.ticks.length).toBeLessThanOrEqual(6);
  });
});

describe('filterWeightEntriesByRange', () => {
  const entries = [
    { timestamp: at('2025-01-01T08:00:00'), value: 80 },
    { timestamp: at('2026-06-15T08:00:00'), value: 78 },
    { timestamp: at('2026-07-01T08:00:00'), value: 77 },
  ];

  it('measures the range back from the newest entry', () => {
    expect(filterWeightEntriesByRange(entries, '1m').map((e) => e.value)).toEqual([78, 77]);
    expect(filterWeightEntriesByRange(entries, '1y')).toHaveLength(2);
  });

  it('keeps everything for "all"', () => {
    expect(filterWeightEntriesByRange(entries, 'all')).toHaveLength(3);
  });
});

describe('pickWeightChartTarget', () => {
  const model = buildWeightChartModel(
    [
      { timestamp: at('2026-06-01T08:00:00'), value: 76 },
      { timestamp: at('2026-07-01T08:00:00'), value: 78 },
    ],
    HEIGHT,
    LAYOUT
  )!;

  it('picks the nearest reading when tapping on it', () => {
    const p = model.points[1];
    expect(pickWeightChartTarget(model, p.x - 3, p.y + 2)).toEqual({ kind: 'point', index: 1 });
  });

  it('picks a reference line when tapping close to it', () => {
    const line = model.refLines.find((r) => r.kind === 'plus10')!;
    expect(pickWeightChartTarget(model, 150, line.y + 5)).toEqual({ kind: 'ref', ref: 'plus10' });
  });

  it('picks nothing in empty space between lines', () => {
    const healthy = model.refLines.find((r) => r.kind === 'healthy')!;
    const plus10 = model.refLines.find((r) => r.kind === 'plus10')!;
    expect(pickWeightChartTarget(model, 150, (plus10.y + healthy.y) / 2)).toBeNull();
  });

  it('picks the healthy area when tapping inside it away from lines and readings', () => {
    const inRange = buildWeightChartModel(
      [
        { timestamp: at('2026-06-01T08:00:00'), value: 55 },
        { timestamp: at('2026-07-01T08:00:00'), value: 56 },
      ],
      HEIGHT,
      LAYOUT
    )!;
    const band = inRange.healthyBand!;
    const healthy = inRange.refLines.find((r) => r.kind === 'healthy')!;
    expect(pickWeightChartTarget(inRange, 150, healthy.y + 30)).toEqual({ kind: 'band' });
    expect(band.yBottom).toBeGreaterThan(healthy.y + 30);
  });
});
