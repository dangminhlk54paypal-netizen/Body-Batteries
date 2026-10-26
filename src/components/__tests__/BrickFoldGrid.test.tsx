import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { BrickFoldGrid, type BrickItem } from '../ui/BrickFoldGrid';
import { useSettingsStore } from '../../store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
});

const titles = ['Đã ăn', 'Vận động', 'Cân bằng', 'Vi chất', 'TPCN', 'Caffeine', 'Nạp nhanh'];
const items: BrickItem[] = titles.map((title, i) => ({
  id: `d${i}`,
  icon: '•',
  title,
  value: `${i} kcal`,
  body: <Text>{`body ${i}`}</Text>,
}));

function render(openIds: string[], onToggle = jest.fn()) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<BrickFoldGrid items={items} openIds={openIds} onToggle={onToggle} />);
  });
  return r;
}

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

describe('BrickFoldGrid', () => {
  it('shows every tile with its key number and no body while folded', () => {
    const r = render([]);
    const all = texts(r);
    for (const title of titles) expect(all).toContain(title);
    expect(all).toContain('3 kcal');
    expect(all.some((s) => s.startsWith('body'))).toBe(false);
  });

  it('opens the bodies under the wall in the order they were opened', () => {
    const all = texts(render(['d4', 'd1']));
    expect(all.filter((s) => s.startsWith('body'))).toEqual(['body 4', 'body 1']);
  });

  it('toggles a tile by id on tap', () => {
    const onToggle = jest.fn();
    const r = render([], onToggle);
    const [tile] = r.root.findAll(
      (n) => n.props.accessibilityLabel === 'Vi chất, 3 kcal' && typeof n.props.onPress === 'function'
    );
    act(() => tile.props.onPress());
    expect(onToggle).toHaveBeenCalledWith('d3');
  });
});
