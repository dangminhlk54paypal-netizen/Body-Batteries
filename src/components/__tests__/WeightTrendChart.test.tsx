import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { WeightTrendChart } from '../WeightTrendChart';
import { shareViewAsImage } from '../../services/share/imageShareService';

// The weight chart has a visible ⤴ (not only a hidden long-press): tapping it
// shares the off-screen poster as an image.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../services/share/imageShareService', () => ({ shareViewAsImage: jest.fn(async () => undefined) }));

const day = (d: number, value: number) => ({ timestamp: new Date(`2026-09-${String(d).padStart(2, '0')}T07:00:00`).getTime(), value });

it('⤴ shares the weight poster; holding the chart does too', async () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<WeightTrendChart entries={[day(1, 80), day(10, 79.2), day(20, 78.6)]} />);
  });
  const shareBtn = r.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Lưu hoặc chia sẻ biểu đồ cân nặng thành ảnh'
  )[0];
  expect(shareBtn).toBeDefined();
  await act(async () => {
    await shareBtn.props.onPress();
  });
  expect(shareViewAsImage).toHaveBeenCalledTimes(1);

  // The poster shows the current weight and the change over the range.
  const texts = r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
  expect(texts).toContain('78.6 kg');
  expect(texts.some((x) => x.startsWith('−1.4 kg'))).toBe(true);

  const chart = r.root.findAll((n) => typeof n.props.onLongPress === 'function')[0];
  await act(async () => {
    await chart.props.onLongPress();
  });
  expect(shareViewAsImage).toHaveBeenCalledTimes(2);
});
