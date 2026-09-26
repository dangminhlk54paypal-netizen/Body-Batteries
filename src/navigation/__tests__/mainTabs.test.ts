import { MAIN_TABS, cycleTab, swipeStep } from '../mainTabs';

describe('cycleTab', () => {
  it('walks forward through the tabs and wraps to the first', () => {
    expect(cycleTab('Home', 1)).toBe('History');
    expect(cycleTab('Diary', 1)).toBe('Settings');
    expect(cycleTab('Settings', 1)).toBe('Home');
  });

  it('walks backward and wraps to the last', () => {
    expect(cycleTab('History', -1)).toBe('Home');
    expect(cycleTab('Home', -1)).toBe('Settings');
  });

  it('visits every tab once per full loop', () => {
    let tab: (typeof MAIN_TABS)[number] = 'Home';
    const seen: string[] = [];
    for (let i = 0; i < MAIN_TABS.length; i++) {
      seen.push(tab);
      tab = cycleTab(tab, 1);
    }
    expect(seen).toEqual([...MAIN_TABS]);
    expect(tab).toBe('Home');
  });
});

describe('swipeStep', () => {
  const W = 400;

  it('switches on a long, slow drag: left = next, right = previous', () => {
    expect(swipeStep(-130, -100, W)).toBe(1);
    expect(swipeStep(130, 100, W)).toBe(-1);
  });

  it('ignores short drags', () => {
    expect(swipeStep(-100, -100, W)).toBe(0);
    expect(swipeStep(40, 2000, W)).toBe(0);
  });

  it('accepts a quick flick over a medium distance', () => {
    expect(swipeStep(-60, -1200, W)).toBe(1);
  });

  it('cancels when the finger flicks back toward the start', () => {
    expect(swipeStep(-200, 1200, W)).toBe(0);
  });
});
