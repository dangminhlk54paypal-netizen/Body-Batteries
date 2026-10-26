import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SubstancePanel } from '../SubstancePanel';
import { useSettingsStore } from '../../store/settingsStore';
import {
  evaluateSubstanceDays,
  summarizeSubstanceHabits,
  type SubstanceEntry,
} from '../../domain/nutrition/substanceEngine';
import { getAnyFoodById } from '../../data/food/foodLookup';
import { dateString } from '../../lib/dateUtils';

// The ☕ panel lays out what substanceEngine computed: bar total, flag chips,
// the selected day's diary, and the 7-day strip that switches days.
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function textOf(n: TestRenderer.ReactTestInstance | string): string {
  return typeof n === 'string' ? n : n.children.map(textOf).join('');
}

function at(daysBack: number, hour: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function journal(entries: SubstanceEntry[]) {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return dateString(d);
  });
  const days = evaluateSubstanceDays(dates, entries, getAnyFoodById, 23);
  return { days, today: days[6], habits: summarizeSubstanceHabits(days), bedtimeHour: 23 };
}

const can = (id: string, timestamp: number): SubstanceEntry => ({
  id,
  foodId: 'monster_energy',
  foodNameVi: 'Monster',
  grams: 355,
  timestamp,
});

it('shows today’s caffeine, the late flag and the diary, and switches day from the strip', async () => {
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.setState({ language: 'en' });
  const j = journal([can('a', at(0, 20)), can('b', at(2, 8)), can('c', at(2, 9))]);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<SubstancePanel journal={j} />);
  });
  const text = () => textOf(tree.root);
  expect(text()).toContain('114 / 400 mg');
  expect(text()).toContain('🌙 114 mg after 17:00');
  expect(text()).toContain('20:00');

  // Two days ago: two cans within an hour → one 227 mg dose.
  const columns = tree.root.findAll(
    (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('227 mg caffeine')
  );
  await act(async () => {
    columns[0].props.onPress();
  });
  expect(text()).toContain('227 / 400 mg');
  expect(text()).toContain('⚠ 227 mg within 1 h (> 200)');
});
