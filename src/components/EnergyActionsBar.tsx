import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { FoodLogModal } from './FoodLogModal';
import { PowerliftingSheet } from './PowerliftingSheet';
import { BodybuildingSheet } from './BodybuildingSheet';
import { ActivityLogSheet } from './ActivityLogSheet';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

// Kept for existing importers; the lists now live in lib/activityCategories.ts.
export { ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '../lib/activityCategories';

export function EnergyActionsBar() {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);

  const [foodOpen, setFoodOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Bumped on every open so ActivityLogSheet remounts and re-reads the saved
  // draft (restore within 5 minutes, else a fresh "as usual" form).
  const [activityKey, setActivityKey] = useState(0);
  const [powerliftingOpen, setPowerliftingOpen] = useState(false);
  const [bodybuildingOpen, setBodybuildingOpen] = useState(false);

  // Tactile press feedback (same pattern as ModeSelector's ModeChip) for the
  // two primary entry-point buttons — onPressIn/onPressOut only flip React
  // state; the shared-value mutation happens in the effects below.
  const [foodBtnPressed, setFoodBtnPressed] = useState(false);
  const [activityBtnPressed, setActivityBtnPressed] = useState(false);
  const foodBtnScale = useSharedValue(1);
  const activityBtnScale = useSharedValue(1);

  useEffect(() => {
    foodBtnScale.value = withTiming(foodBtnPressed ? 0.96 : 1, {
      duration: foodBtnPressed ? 100 : 150,
    });
  }, [foodBtnPressed, foodBtnScale]);

  useEffect(() => {
    activityBtnScale.value = withTiming(activityBtnPressed ? 0.96 : 1, {
      duration: activityBtnPressed ? 100 : 150,
    });
  }, [activityBtnPressed, activityBtnScale]);

  const foodBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: foodBtnScale.value }],
  }));
  const activityBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activityBtnScale.value }],
  }));

  function openActivity() {
    setActivityKey((k) => k + 1);
    setActivityOpen(true);
  }

  function openPowerlifting() {
    setActivityOpen(false);
    setPowerliftingOpen(true);
  }

  function openBodybuilding() {
    setActivityOpen(false);
    setBodybuildingOpen(true);
  }

  return (
    <View style={styles.container}>
      {/* Two equal-width entry points: log food (charge) / log activity (burn).
          The manual "add calories" entry point (calorie-typed shortcut) was
          removed — logging a food from the list is the only charge path now.
          useEnergyStore.addCalories itself is left in place (unused by any
          UI as of this change) so historical entries it already wrote to
          intake_events keep reading back correctly. */}
      <View style={styles.bar}>
        <Animated.View style={[styles.btnWrap, foodBtnAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.food, pressed && styles.pressed]}
            onPress={() => setFoodOpen(true)}
            onPressIn={() => setFoodBtnPressed(true)}
            onPressOut={() => setFoodBtnPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={t('components.energyActionsBar.logFoodButton')}
          >
            <Text style={styles.btnText} numberOfLines={1} adjustsFontSizeToFit>
              {t('components.energyActionsBar.logFoodButton')}
            </Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={[styles.btnWrap, activityBtnAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.move, pressed && styles.pressed]}
            onPress={openActivity}
            onPressIn={() => setActivityBtnPressed(true)}
            onPressOut={() => setActivityBtnPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={t('components.energyActionsBar.activityButton')}
          >
            <Text style={styles.btnText} numberOfLines={1} adjustsFontSizeToFit>
              {t('components.energyActionsBar.activityButton')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <FoodLogModal visible={foodOpen} onClose={() => setFoodOpen(false)} />

      {/* Activity / workout */}
      <ActivityLogSheet
        key={activityKey}
        visible={activityOpen}
        onClose={() => setActivityOpen(false)}
        onOpenPowerlifting={openPowerlifting}
        onOpenBodybuilding={openBodybuilding}
      />

      {/* S-PL: set-based powerlifting logging (squat/bench/deadlift) */}
      <PowerliftingSheet visible={powerliftingOpen} onClose={() => setPowerliftingOpen(false)} />

      {/* S-BB: set-based bodybuilding logging, browsed by muscle group */}
      <BodybuildingSheet visible={bodybuildingOpen} onClose={() => setBodybuildingOpen(false)} />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  bar: { flexDirection: 'row', gap: 10 },
  btnWrap: { flex: 1 },
  btn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center' },
  food: { backgroundColor: c.infoAlt },
  move: { backgroundColor: c.danger },
  btnText: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
