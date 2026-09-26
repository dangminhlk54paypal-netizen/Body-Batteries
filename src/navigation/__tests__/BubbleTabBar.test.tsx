import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { SlideTabBarProps } from '../SlideTabNavigator';
import { BubbleTabBar } from '../BubbleTabBar';
import { MAIN_TABS } from '../mainTabs';

jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));

function setup(focusedIndex: number) {
  const routes = MAIN_TABS.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
    getState: () => ({ index: focusedIndex, routes }),
  };
  const descriptors = Object.fromEntries(
    routes.map((r) => [r.key, { options: { tabBarLabel: `label-${r.name}` } }])
  );
  const props = {
    state: { index: focusedIndex, routes },
    descriptors,
    navigation,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as SlideTabBarProps;
  return { props, navigation };
}

it('shows the five tabs, marks the focused one, and a tap opens a tab', async () => {
  const { props, navigation } = setup(0);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BubbleTabBar {...props} />);
  });
  const tabs = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string');
  expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual(MAIN_TABS.map((n) => `label-${n}`));
  expect(tabs[0].props.accessibilityState).toEqual({ selected: true });

  await act(async () => tabs[2].props.onAccessibilityTap());
  expect(navigation.navigate).toHaveBeenCalledWith('Training', undefined);

  // Tapping the tab you're already on doesn't navigate again.
  navigation.navigate.mockClear();
  await act(async () => tabs[0].props.onAccessibilityTap());
  expect(navigation.navigate).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
