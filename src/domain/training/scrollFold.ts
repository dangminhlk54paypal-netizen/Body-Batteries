// "Water-slide" folding for a long list of sections (the block plan's weeks):
// a section reads open while you scroll through it and folds itself once it
// has slid out of view above. Pure: layouts + scroll offset in, indexes out.

export interface SectionLayout {
  top: number; // y inside the scroll content
  height: number;
}

// Indexes of the sections whose bottom edge has scrolled more than `margin`
// above the top of the viewport. A folded section is then only its header, so
// it unfolds again as soon as that header comes back within `margin` — the
// gap between the two thresholds keeps it from flickering.
export function sectionsScrolledPast(
  layouts: (SectionLayout | undefined)[],
  scrollY: number,
  margin = 40
): number[] {
  const past: number[] = [];
  layouts.forEach((l, i) => {
    if (l && l.top + l.height < scrollY - margin) past.push(i);
  });
  return past;
}
