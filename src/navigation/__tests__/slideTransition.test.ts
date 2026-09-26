import { setPendingDirection, slideDirection, slidePlan } from '../slideTransition';

describe('slideDirection', () => {
  it('follows the tab order when nothing else says otherwise', () => {
    expect(slideDirection(0, 3)).toBe(1);
    expect(slideDirection(3, 1)).toBe(-1);
  });

  it('uses a swipe direction once (wrapping Settings → Home moves forward)', () => {
    setPendingDirection(1);
    expect(slideDirection(4, 0)).toBe(1);
    expect(slideDirection(4, 0)).toBe(-1);
  });
});

describe('slidePlan', () => {
  it('slides the new page in from the right and the old one out to the left', () => {
    const { start, end } = slidePlan([0, 1, 1, 1, 1], 2, 1);
    expect(start).toEqual([0, 1, 1, 1, 1]);
    expect(end).toEqual([-1, 1, 0, 1, 1]);
  });

  it('brings a page parked on the far side round to the incoming side', () => {
    const { start } = slidePlan([0, -1, 1, 1, 1], 1, 1);
    expect(start[1]).toBe(1);
  });

  it('continues a page that is already part-way in (dragged or mid-switch)', () => {
    const { start, end } = slidePlan([-0.4, 0.6, 1, 1, 1], 1, 1);
    expect(start).toEqual([-0.4, 0.6, 1, 1, 1]);
    expect(end).toEqual([-1, 0, 1, 1, 1]);
  });

  it('reverses cleanly when the user scrubs back mid-switch', () => {
    // Heading right: page 1 was coming in (0.5), page 0 leaving (-0.5); now back to 0.
    const { start, end } = slidePlan([-0.5, 0.5, 1, 1, 1], 0, -1);
    expect(start).toEqual([-0.5, 0.5, 1, 1, 1]);
    expect(end).toEqual([0, 1, 1, 1, 1]);
  });
});
