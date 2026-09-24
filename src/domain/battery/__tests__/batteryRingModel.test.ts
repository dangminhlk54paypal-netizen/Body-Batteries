import {
  RING_GEOMETRY,
  arcPath,
  dailyBatteryRatio,
  ringSlots,
  slotArcs,
  slotAtPoint,
} from '../batteryRingModel';
import type { DailyBatteryTotals } from '../dailyBatteryTotals';

const totals: DailyBatteryTotals = {
  protein: 120,
  carbs: 0,
  minerals: 500,
  water: 4000,
  sleep: 7,
  movementSteps: 4000,
  movementKcal: 350,
};

describe('dailyBatteryRatio', () => {
  it("is today's intake over the daily target", () => {
    expect(dailyBatteryRatio('protein', totals, 180)).toBeCloseTo(2 / 3);
    expect(dailyBatteryRatio('water', totals, 3500)).toBeCloseTo(4000 / 3500);
    expect(dailyBatteryRatio('movement', totals, 8000)).toBe(0.5); // steps, not kcal
  });

  it('is 0 for an unknown id or a missing target', () => {
    expect(dailyBatteryRatio('energy', totals, 100)).toBe(0);
    expect(dailyBatteryRatio('protein', totals, 0)).toBe(0);
  });
});

describe('ringSlots / slotArcs', () => {
  const slots = ringSlots(6, 6);

  it('splits the circle into equal slots separated by the gap', () => {
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({ startDeg: 3, endDeg: 57 });
    expect(slots[5]).toEqual({ startDeg: 303, endDeg: 357 });
  });

  it('shortens the arc below 100 % and adds an outer arc above it', () => {
    const under = slotArcs(slots[0], 2 / 3);
    expect(under.fill!.endDeg - under.fill!.startDeg).toBeCloseTo(36);
    expect(under.overflow).toBeNull();

    const over = slotArcs(slots[0], 4000 / 3500);
    expect(over.fill).toEqual(slots[0]);
    expect(over.overflow!.endDeg - over.overflow!.startDeg).toBeCloseTo(54 * (500 / 3500));
  });

  it('draws nothing at 0 % and caps the overflow at one extra slot', () => {
    expect(slotArcs(slots[0], 0)).toEqual({ fill: null, overflow: null });
    expect(slotArcs(slots[0], 5).overflow).toEqual(slots[0]);
  });
});

describe('arcPath', () => {
  it('starts at 12 o\'clock for 0°', () => {
    expect(arcPath(100, 100, 50, { startDeg: 0, endDeg: 90 })).toBe('M 100.00 50.00 A 50 50 0 0 1 150.00 100.00');
  });
});

describe('slotAtPoint', () => {
  const c = RING_GEOMETRY.size / 2;
  const r = RING_GEOMETRY.radius;

  it('maps a tap on the ring to its slot, clockwise from 12 o\'clock', () => {
    expect(slotAtPoint(c + 10, c - r, 6)).toBe(0); // just right of top
    expect(slotAtPoint(c + r, c, 6)).toBe(1); // 3 o'clock = 90°
    expect(slotAtPoint(c - 10, c - r, 6)).toBe(5); // just left of top
  });

  it('ignores taps in the hole or far outside', () => {
    expect(slotAtPoint(c, c, 6)).toBeNull();
    expect(slotAtPoint(0, 0, 6)).toBeNull();
  });
});
