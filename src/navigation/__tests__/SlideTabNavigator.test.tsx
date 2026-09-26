import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createSlideTabNavigator } from '../SlideTabNavigator';
import { BubbleTabBar } from '../BubbleTabBar';
import { MAIN_TABS } from '../mainTabs';
import { pageOffsets } from '../pageOffsets';
import { GestureDetector } from 'react-native-gesture-handler';

// Pages slide past each other: switching sends the old page off one side and
// brings the new one to 0; the focused tab's neighbours are already mounted.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  // The stock mock makes a new object every render; the real hook is stable
  // (and the gesture-identity test below depends on that).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useSharedValue: (init: unknown) => require('react').useState(() => ({ value: init }))[0],
}));
// The mock's makeMutable returns a bare number; give each tab a real box.
jest.mock('../pageOffsets', () => ({
  pageOffsets: Object.fromEntries(
    ['Home', 'History', 'Training', 'Diary', 'Settings'].map((t, i) => [t, { value: i === 0 ? 0 : 1 }])
  ),
}));
jest.mock('react-native-safe-area-context', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-safe-area-context/jest/mock').default
);
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

const Tab = createSlideTabNavigator();
const screens = Object.fromEntries(
  MAIN_TABS.map((name) => [name, () => <Text>{`PAGE_${name}`}</Text>])
) as Record<string, React.ComponentType>;

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('|');
}

it('mounts the neighbours and slides the old page out when a tab is tapped', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <NavigationContainer>
        <Tab.Navigator tabBar={(props) => <BubbleTabBar {...props} />}>
          {MAIN_TABS.map((name) => (
            <Tab.Screen key={name} name={name} component={screens[name]} options={{ tabBarLabel: name }} />
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    );
  });

  let text = textOf(tree.root);
  expect(text).toContain('PAGE_Home');
  expect(text).toContain('PAGE_History');
  expect(text).toContain('PAGE_Settings'); // Home's left neighbour (the loop)
  expect(text).not.toContain('PAGE_Training');

  const tabs = () => tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string');
  await act(async () => tabs()[2].props.onAccessibilityTap());

  text = textOf(tree.root);
  expect(text).toContain('PAGE_Training');
  expect(text).toContain('PAGE_Diary');
  expect(pageOffsets.Training.value).toBe(0);
  expect(pageOffsets.Home.value).toBe(-1); // left, since Training is to its right
  expect(tabs()[2].props.accessibilityState).toEqual({ selected: true });

  // Back to History: it comes in from the left, Training leaves to the right.
  await act(async () => tabs()[1].props.onAccessibilityTap());
  expect(pageOffsets.History.value).toBe(0);
  expect(pageOffsets.Training.value).toBe(1);
  await act(async () => tree.unmount());
});

it('keeps the same tab-bar gesture across tab switches (so finger-up is never lost)', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <NavigationContainer>
        <Tab.Navigator tabBar={(props) => <BubbleTabBar {...props} />}>
          {MAIN_TABS.map((name) => (
            <Tab.Screen key={name} name={name} component={screens[name]} options={{ tabBarLabel: name }} />
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    );
  });
  const barGesture = () => tree.root.findAllByType(GestureDetector)[0].props.gesture;
  const before = barGesture();
  const tabs = () => tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string');
  await act(async () => tabs()[3].props.onAccessibilityTap());
  await act(async () => tabs()[1].props.onAccessibilityTap());
  expect(barGesture()).toBe(before);
  await act(async () => tree.unmount());
});
