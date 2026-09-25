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
    expect(shown).toContain('Bench có dừng 1s trên ngực (Paused Bench)');
    expect(shown).not.toContain('Squat tiêu chuẩn');
    pressText(tree, 'Bench có dừng 1s trên ngực (Paused Bench)');
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
