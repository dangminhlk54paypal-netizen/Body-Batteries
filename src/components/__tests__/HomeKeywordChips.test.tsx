import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { HomeKeywordChips } from '../HomeKeywordChips';
import { useSettingsStore } from '../../store/settingsStore';
import { darkColors } from '../../lib/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => {
  useSettingsStore.setState({ language: 'vi', themeMode: 'dark' });
});

describe('HomeKeywordChips', () => {
  it('renders nothing when there is no keyword', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<HomeKeywordChips keywords={[]} onPress={jest.fn()} />);
    });
    expect(r.toJSON()).toBeNull();
  });

  it('shows short, toned texts and taps through to the battery', () => {
    const onPress = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <HomeKeywordChips
          keywords={[
            { battery: 'protein', tone: 'low', kind: 'short', amount: 30 },
            { battery: 'water', tone: 'mid', kind: 'short', amount: 2 },
            { battery: 'sleep', tone: 'good', kind: 'done', amount: 0 },
          ]}
          onPress={onPress}
        />
      );
    });
    const texts = r.root.findAllByType(Text);
    expect(texts.map((t) => t.props.children)).toEqual(['Thiếu 30g đạm', 'Uống thêm 2 ly', 'Ngủ đủ']);
    // Low = soft coral token, never the alarm red.
    const lowStyle = Object.assign({}, ...[texts[0].props.style].flat());
    expect(lowStyle.color).toBe(darkColors.statusLow);
    act(() => {
      r.root
        .findAll((n) => n.props.accessibilityLabel === 'Uống thêm 2 ly' && typeof n.props.onPress === 'function')[0]
        .props.onPress();
    });
    expect(onPress).toHaveBeenCalledWith('water');
  });
});
