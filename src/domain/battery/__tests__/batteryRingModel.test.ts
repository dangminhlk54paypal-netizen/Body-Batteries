import {
  RING_GEOMETRY,
  arcPath,
  calloutBox,
  calloutLayout,
  calloutWire,
  dailyBatteryRatio,
  ringSlots,
  slotArcs,
  slotAtPoint,
  slotMidDeg,
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

describe('wired labels (calloutLayout)', () => {
  // Phone widths minus the 16 px gutters: iPhone mini/SE 375 → 343, 390 → 358, Pro Max 430 → 398.
  const widths = [343, 358, 398];
  const counts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  function boxes(width: number, count: number, spin: number) {
    const l = calloutLayout(width, count);
    return {
      l,
      list: Array.from({ length: count }, (_, i) => {
        const [left, top] = calloutBox(slotMidDeg(i, count) + spin, l);
        return { left, top, right: left + l.labelWidth, bottom: top + l.labelHeight };
      }),
    };
  }

  it.each(widths)('width %i: at every spin no labels overlap, touch the ring or leave the stage', (width) => {
    for (const count of counts) {
      for (let spin = 0; spin < 360; spin += 3) {
        const { l, list } = boxes(width, count, spin);
        const ringOuter = (RING_GEOMETRY.radius + RING_GEOMETRY.thickness / 2 + 4) * l.scale;
        list.forEach((b, i) => {
          expect(b.left).toBeGreaterThanOrEqual(-0.5);
          expect(b.right).toBeLessThanOrEqual(width + 0.5);
          expect(b.top).toBeGreaterThanOrEqual(-0.5);
          expect(b.bottom).toBeLessThanOrEqual(l.height + 0.5);
          const nx = Math.max(b.left, Math.min(l.cx, b.right));
          const ny = Math.max(b.top, Math.min(l.cy, b.bottom));
          expect(Math.hypot(nx - l.cx, ny - l.cy)).toBeGreaterThan(ringOuter);
          for (const o of list.slice(i + 1)) {
            const overlap = b.left < o.right - 2 && o.left < b.right - 2 && b.top < o.bottom - 2 && o.top < b.bottom - 2;
            expect(overlap).toBe(false);
          }
        });
      }
    }
  });

  it('keeps the ring full size on a 390-wide phone', () => {
    expect(calloutLayout(358, 6).scale).toBe(1);
  });

  it('the wire runs from the ring out to its label', () => {
    const l = calloutLayout(358, 6);
    const [x0, y0, x1, y1] = calloutWire(90, l); // 3 o'clock
    expect(y0).toBeCloseTo(l.cy);
    expect(y1).toBeCloseTo(l.cy);
    expect(x0).toBeCloseTo(l.cx + l.wireStart);
    expect(x1).toBeCloseTo(calloutBox(90, l)[0]); // ends at the label's left edge
  });

  it('a tap on a spun ring finds the slot that is now under the finger', () => {
    const c = RING_GEOMETRY.size / 2;
    // Top of the ring is slot 0 of 6; spun 90° clockwise, slot 4 (240°–300°)
    // has moved round to 330°–30°, i.e. the top.
    expect(slotAtPoint(c + 5, c - RING_GEOMETRY.radius, 6)).toBe(0);
    expect(slotAtPoint(c + 5, c - RING_GEOMETRY.radius, 6, RING_GEOMETRY, 90)).toBe(4);
    expect(slotAtPoint(c + 5, c - RING_GEOMETRY.radius, 6, RING_GEOMETRY, -270)).toBe(4);
  });
});

describe('slotAtPoint without a tap position', () => {
  it('returns null instead of NaN', () => {
    expect(slotAtPoint(Number.NaN, Number.NaN, 6)).toBeNull();
  });
});
