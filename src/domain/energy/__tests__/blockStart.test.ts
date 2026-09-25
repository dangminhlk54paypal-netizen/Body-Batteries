import { blockNumberOf, blockStartForCurrentWeek, nextBlockNumber } from '../blockStart';
import type { GeneratedBlockPlan } from '../../../types/powerliftingBlock';

const plan = (createdAt: number, blockNumber?: number) =>
  ({ config: { id: String(createdAt), createdAt, blockNumber }, weeks: [] }) as unknown as GeneratedBlockPlan;

describe('blockStartForCurrentWeek — joining a block that already runs', () => {
  it('week 1 starts this Monday; week 4 started three Mondays ago', () => {
    expect(blockStartForCurrentWeek('2026-09-21', 1)).toBe('2026-09-21');
    expect(blockStartForCurrentWeek('2026-09-21', 4)).toBe('2026-08-31');
  });
});

describe('nextBlockNumber', () => {
  it('1 for the first block, else one past the highest (own numbers win)', () => {
    expect(nextBlockNumber([])).toBe(1);
    expect(nextBlockNumber([plan(1), plan(2)])).toBe(3);
    expect(nextBlockNumber([plan(1, 3)])).toBe(4); // "Block 3" of a long-time lifter → next is 4
  });
});

describe('blockNumberOf', () => {
  const withWeeks = (p: GeneratedBlockPlan) => ({ ...p, weeks: [{}] }) as unknown as GeneratedBlockPlan;
  it('the user’s own number, else creation order', () => {
    const a = withWeeks(plan(1));
    const b = withWeeks(plan(2));
    expect(blockNumberOf(b, [b, a])).toBe(2);
    expect(blockNumberOf(withWeeks(plan(3, 7)), [a, b])).toBe(7);
    expect(blockNumberOf(a, [])).toBe(1);
  });
});
