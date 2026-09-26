// Geometry of the tab bar's "bubble wave" (BubbleTabBar.tsx): while a finger
// slides along the bar, each tab icon swells and lifts by how close it is to
// the finger, so the row bends into a smooth hump that follows the finger.
// All functions run on the UI thread ('worklet'); plain JS in tests.

// 0..1: 1 right under the finger, fading smoothly (bell curve) with distance.
// `spread` ≈ one tab width keeps the neighbours visibly lifted too.
export function bubbleInfluence(distance: number, spread: number): number {
  'worklet';
  if (spread <= 0) return 0;
  const r = distance / spread;
  return Math.exp(-(r * r) / 2);
}

// Which tab the finger is over; outside the bar clamps to the nearest end.
export function tabIndexAt(x: number, barWidth: number, count: number): number {
  'worklet';
  if (barWidth <= 0 || count <= 0) return 0;
  const i = Math.floor((x / barWidth) * count);
  return Math.min(count - 1, Math.max(0, i));
}

// Horizontal centre of tab `index`.
export function tabCenterX(index: number, barWidth: number, count: number): number {
  'worklet';
  return ((index + 0.5) * barWidth) / count;
}
