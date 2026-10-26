// Packs a list of tiles into "brick wall" rows: 1–3 tiles per row, the row
// counts alternating (2 · 3 · 2 …) so the seams never line up, and a row
// never holding more text than fits across the screen. Used by Home's
// "Chi tiết hôm nay" tiles; pure so the arrangement is testable.

export const BRICK_MAX_PER_ROW = 3;

// Rough width (in characters) a tile needs for its keyword: the title plus
// room for the icon and padding.
export function brickCost(title: string): number {
  return Array.from(title).length + 6;
}

// How many characters fit across one row at this screen width (bold 14 pt
// ≈ 8 pt per character, 20-pt gutters each side).
export function brickCapacity(screenWidth: number): number {
  return Math.max(12, Math.floor((screenWidth - 40) / 8));
}

// Penalties: every row costs 1 (fewer rows = more compact); two neighbour
// rows with the same count line their seams up (not a brick wall); a lone
// tile is allowed only when nothing else fits.
const REPEAT_PENALTY = 3;
const SINGLE_PENALTY = 2;

// Returns the number of tiles in each row, top to bottom.
export function packBrickRows(costs: number[], capacity: number): number[] {
  const n = costs.length;
  if (n === 0) return [];
  // best[i][p] = cheapest layout of tiles i.. given the previous row held p.
  const memo = new Map<string, { score: number; rows: number[] }>();
  const solve = (i: number, prev: number): { score: number; rows: number[] } => {
    if (i === n) return { score: 0, rows: [] };
    const key = `${i}:${prev}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let best: { score: number; rows: number[] } | null = null;
    let width = 0;
    for (let k = 1; k <= BRICK_MAX_PER_ROW && i + k <= n; k++) {
      width += costs[i + k - 1];
      // One tile always fits (it just gets the whole row).
      if (k > 1 && width > capacity) break;
      const rest = solve(i + k, k);
      const score =
        1 + (k === prev ? REPEAT_PENALTY : 0) + (k === 1 ? SINGLE_PENALTY : 0) + rest.score;
      if (!best || score < best.score) best = { score, rows: [k, ...rest.rows] };
    }
    memo.set(key, best!);
    return best!;
  };
  return solve(0, 0).rows;
}
