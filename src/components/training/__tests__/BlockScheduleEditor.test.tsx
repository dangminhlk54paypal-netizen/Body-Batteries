import React from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BlockScheduleEditor } from '../BlockScheduleEditor';
import { useSettingsStore } from '../../../store/settingsStore';
import type { BlockDayPlan } from '../../../types/powerliftingBlock';

// The weekly schedule is one page per weekday; a lift is chosen from a picker
// you can type into or scroll.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
});

function render(days: BlockDayPlan[], onChange = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<BlockScheduleEditor days={days} onChange={onChange} onUseTemplate={jest.fn()} />);
  });
  // The pager renders once the window has a width.
  const window = tree.root.findAll((n) => typeof n.props.onLayout === 'function')[0];
  act(() => window.props.onLayout({ nativeEvent: { layout: { width: 320, height: 300 } } }));
  return tree;
}

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
const pressText = (tree: TestRenderer.ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => typeof n.props.onPress === 'function' && texts({ root: n } as never).includes(label))[0];
  act(() => node.props.onPress());
};

const pagerOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(ScrollView).find((s) => s.props.horizontal)!;
const dayTabs = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');
const selectedDay = (tree: TestRenderer.ReactTestRenderer) =>
  dayTabs(tree).findIndex((n) => n.props.accessibilityState?.selected);
const scrollEvent = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 } } });

describe('BlockScheduleEditor pager', () => {
  // On iOS (Fabric) every change of the contentOffset prop jumps the scroll
  // position at once — mid-drag or mid-animation. The pager must never move
  // it after mount, or a tap lands on the wrong day and a swipe jerks.
  it('tapping a day selects exactly that day, even while the scroll animation passes others', () => {
    const tree = render([]);
    const startOffset = pagerOf(tree).props.contentOffset;
    act(() => dayTabs(tree)[2].props.onPress()); // Wednesday
    expect(selectedDay(tree)).toBe(2);
    // The animation from Monday passes Tuesday on its way.
    act(() => pagerOf(tree).props.onScroll(scrollEvent(320)));
    expect(selectedDay(tree)).toBe(2);
    act(() => pagerOf(tree).props.onMomentumScrollEnd(scrollEvent(640)));
    expect(selectedDay(tree)).toBe(2);
    expect(pagerOf(tree).props.contentOffset).toEqual(startOffset);
  });

  it('a swipe follows the finger without the offset being reset under it', () => {
    const tree = render([]);
    const startOffset = pagerOf(tree).props.contentOffset;
    act(() => pagerOf(tree).props.onScrollBeginDrag(scrollEvent(0)));
    act(() => pagerOf(tree).props.onScroll(scrollEvent(200))); // past half a page
    expect(selectedDay(tree)).toBe(1);
    expect(pagerOf(tree).props.contentOffset).toEqual(startOffset);
    act(() => pagerOf(tree).props.onMomentumScrollEnd(scrollEvent(320)));
    expect(selectedDay(tree)).toBe(1);
  });

  it('comes back on the same day after the lift picker closes', () => {
    const tree = render([]);
    act(() => dayTabs(tree)[4].props.onPress()); // Friday
    act(() => pagerOf(tree).props.onMomentumScrollEnd(scrollEvent(4 * 320)));
    pressText(tree, '+ Thêm buổi tập');
    pressText(tree, 'Huỷ');
    expect(selectedDay(tree)).toBe(4);
    expect(pagerOf(tree).props.contentOffset).toEqual({ x: 4 * 320, y: 0 });
  });
});

describe('BlockScheduleEditor', () => {
  it('shows all seven weekdays as swipeable pages', () => {
    const tree = render([]);
    const pager = tree.root.findAllByType(ScrollView).find((s) => s.props.horizontal);
    expect(pager?.props.pagingEnabled).toBe(true);
    expect(texts(tree).filter((s) => s === 'Ngày nghỉ — chưa có buổi tập.')).toHaveLength(7);
  });

  it('adds a session by typing in the picker; the first lift is the main one', () => {
    const onChange = jest.fn();
    const tree = render([], onChange);
    pressText(tree, '+ Thêm buổi tập');
    const search = tree.root.findByType(TextInput);
    act(() => search.props.onChangeText('bench dung'));
    const shown = texts(tree);
    expect(shown).toContain('Comp Bench'); // found through its descriptive name (aka)
    expect(shown).not.toContain('Paused Squat');
    pressText(tree, 'Comp Bench');
    expect(onChange).toHaveBeenCalledWith([
      {
        dayOfWeek: 1,
        variations: [{ exercise: 'bench_press', variationId: 'bench_paused', role: 'main' }],
        accessories: [],
      },
    ]);
  });

  it('a lift row toggles main/secondary with one tap', () => {
    const onChange = jest.fn();
    const tree = render(
      [{ dayOfWeek: 1, variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }], accessories: [] }],
      onChange
    );
    pressText(tree, 'Chính');
    expect(onChange.mock.calls[0][0][0].variations[0].role).toBe('secondary');
  });
});
