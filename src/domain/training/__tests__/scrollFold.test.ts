import { sectionsScrolledPast } from '../scrollFold';

describe('sectionsScrolledPast', () => {
  const layouts = [
    { top: 100, height: 400 }, // ends at 500
    { top: 500, height: 400 }, // ends at 900
    undefined, // not laid out yet
    { top: 900, height: 40 },
  ];

  it('only sections fully above the viewport (by the margin) fold', () => {
    expect(sectionsScrolledPast(layouts, 0)).toEqual([]);
    expect(sectionsScrolledPast(layouts, 530)).toEqual([]); // week 1 just left: within the margin
    expect(sectionsScrolledPast(layouts, 560)).toEqual([0]);
    expect(sectionsScrolledPast(layouts, 1000)).toEqual([0, 1, 3]);
  });

  it('a folded section (just its header) unfolds when the header is back near the top', () => {
    const folded = [{ top: 100, height: 40 }];
    expect(sectionsScrolledPast(folded, 190)).toEqual([0]);
    expect(sectionsScrolledPast(folded, 170)).toEqual([]);
  });
});
