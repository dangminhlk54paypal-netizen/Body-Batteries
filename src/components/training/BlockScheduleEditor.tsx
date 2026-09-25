import React, { useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { WEEK_ORDER, matchesSearch, setScheduleDay } from '../../domain/energy/blockSchedule';
import type { Weekday } from '../../domain/energy/blockSchedule';
import { variationsForExercise } from '../../lib/powerliftingVariations';
import type { PowerliftingVariation } from '../../lib/powerliftingVariations';
import { weekdayLabel } from '../../lib/dateUtils';
import { parseDecimal } from '../../lib/units';
import { useT } from '../../i18n/useT';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { AccessoryLineItem, BlockDayPlan, BlockDayVariation } from '../../types/powerliftingBlock';

// The Block Builder's "Lịch tuần" step: one page per weekday inside a fixed
// window — swipe (or tap the week strip) to move between days, so the whole
// week never turns into one endless scroll. A lift is one compact row; its
// exercise + technique are chosen in a picker you can type into or scroll.

const PAGE_HEIGHT = 300;

interface Props {
  days: BlockDayPlan[];
  onChange: (days: BlockDayPlan[]) => void;
  onUseTemplate: () => void;
}

// Which lift the picker fills: an existing row, or a new one (index null).
interface PickerTarget {
  dayOfWeek: Weekday;
  index: number | null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BlockScheduleEditor({ days, onChange, onUseTemplate }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const pagerRef = useRef<ScrollView>(null);

  // Opens on the first planned day (Monday for an empty week).
  const [page, setPage] = useState(() =>
    Math.max(
      0,
      WEEK_ORDER.findIndex((dow) => days.some((d) => d.dayOfWeek === dow))
    )
  );
  const [width, setWidth] = useState(0);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [query, setQuery] = useState('');

  const dayOf = (dow: Weekday) => days.find((d) => d.dayOfWeek === dow);
  const emptyDay = (dow: Weekday): BlockDayPlan => ({ dayOfWeek: dow, variations: [], accessories: [] });

  function patchDay(dow: Weekday, fn: (d: BlockDayPlan) => BlockDayPlan | null) {
    onChange(setScheduleDay(days, dow, fn(dayOf(dow) ?? emptyDay(dow))));
  }

  function goTo(index: number) {
    setPage(index);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  }

  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page && i >= 0 && i < WEEK_ORDER.length) setPage(i);
  }

  function openPicker(dayOfWeek: Weekday, index: number | null) {
    setQuery('');
    setPicker({ dayOfWeek, index });
  }

  function pick(v: PowerliftingVariation) {
    if (!picker) return;
    const { dayOfWeek, index } = picker;
    patchDay(dayOfWeek, (d) => ({
      ...d,
      variations:
        index == null
          ? [...d.variations, { exercise: v.exercise, variationId: v.id, role: d.variations.length === 0 ? 'main' : 'secondary' }]
          : d.variations.map((x, i) => (i === index ? { ...x, exercise: v.exercise, variationId: v.id } : x)),
    }));
    setPicker(null);
  }

  function updateVariation(dow: Weekday, index: number, patch: Partial<BlockDayVariation>) {
    patchDay(dow, (d) => ({ ...d, variations: d.variations.map((v, i) => (i === index ? { ...v, ...patch } : v)) }));
  }
  function removeVariation(dow: Weekday, index: number) {
    patchDay(dow, (d) => ({ ...d, variations: d.variations.filter((_, i) => i !== index) }));
  }
  function updateAccessory(dow: Weekday, index: number, patch: Partial<AccessoryLineItem>) {
    patchDay(dow, (d) => ({ ...d, accessories: d.accessories.map((a, i) => (i === index ? { ...a, ...patch } : a)) }));
  }
  function addAccessory(dow: Weekday) {
    patchDay(dow, (d) => ({ ...d, accessories: [...d.accessories, { customName: '', sets: 3, reps: '8-12' }] }));
  }
  function removeAccessory(dow: Weekday, index: number) {
    patchDay(dow, (d) => ({ ...d, accessories: d.accessories.filter((_, i) => i !== index) }));
  }

  function renderStrip() {
    return (
      <View style={styles.strip}>
        {WEEK_ORDER.map((dow, i) => {
          const planned = dayOf(dow);
          const active = i === page;
          const incomplete = planned != null && planned.variations.length === 0;
          return (
            <Pressable
              key={dow}
              onPress={() => goTo(i)}
              style={({ pressed }) => [styles.stripDay, active && styles.stripDayActive, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={weekdayLabel(dow, language, 'long')}
            >
              <Text style={[styles.stripText, planned && styles.stripTextPlanned, active && styles.stripTextActive]}>
                {weekdayLabel(dow, language, 'short')}
              </Text>
              <View
                style={[
                  styles.stripDot,
                  planned && styles.stripDotPlanned,
                  incomplete && styles.stripDotWarn,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderRestDay(dow: Weekday) {
    return (
      <View style={styles.restBox}>
        <Text style={styles.restText}>{t('blockBuilder.scheduleEmptyText')}</Text>
        <Pressable style={({ pressed }) => [styles.addDayBtn, pressed && styles.pressed]} onPress={() => openPicker(dow, null)}>
          <Text style={styles.addDayText}>{t('blockBuilder.scheduleAddDayButton')}</Text>
        </Pressable>
        {days.length === 0 && (
          <Pressable style={({ pressed }) => [styles.templateBtn, pressed && styles.pressed]} onPress={onUseTemplate}>
            <Text style={styles.templateBtnText}>{t('blockBuilder.useSuggestedTemplateButton')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  function renderSession(dow: Weekday, day: BlockDayPlan) {
    return (
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
      >
        {day.variations.map((v, i) => (
          <View key={i} style={styles.liftRow}>
            <Pressable
              hitSlop={4}
              onPress={() => updateVariation(dow, i, { role: v.role === 'main' ? 'secondary' : 'main' })}
              style={({ pressed }) => [styles.rolePill, v.role === 'main' && styles.rolePillMain, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('blockBuilder.scheduleRoleToggleA11y')}
            >
              <Text style={[styles.rolePillText, v.role === 'main' && styles.rolePillTextMain]}>
                {v.role === 'main' ? t('blockBuilder.scheduleRoleMain') : t('blockBuilder.scheduleRoleSecondary')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.liftName, pressed && styles.pressed]}
              onPress={() => openPicker(dow, i)}
              accessibilityRole="button"
            >
              <Text style={styles.liftExercise}>{t(`activities.${v.exercise}`)}</Text>
              <Text style={styles.liftVariation} numberOfLines={1}>
                {t(`blockVariations.${v.variationId}.label`)}
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => removeVariation(dow, i)}
              accessibilityRole="button"
              accessibilityLabel={t('blockBuilder.scheduleRemoveVariationButton')}
            >
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} onPress={() => openPicker(dow, null)}>
          <Text style={styles.addText}>{t('blockBuilder.scheduleAddVariationButton')}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t('blockBuilder.scheduleAccessorySectionTitle')}</Text>
        {day.accessories.map((acc, i) => (
          <View key={i} style={styles.accessoryRow}>
            <TextInput
              style={[styles.input, styles.accessoryName]}
              placeholder={t('blockBuilder.accessoryNamePlaceholder')}
              placeholderTextColor={c.textMuted}
              value={acc.customName}
              onChangeText={(v) => updateAccessory(dow, i, { customName: v })}
            />
            <TextInput
              style={[styles.input, styles.accessorySmall]}
              placeholder={t('blockBuilder.accessorySetsPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              value={String(acc.sets)}
              onChangeText={(v) => updateAccessory(dow, i, { sets: Math.max(1, Math.round(parseDecimal(v)) || 1) })}
              accessibilityLabel={t('blockBuilder.accessorySetsPlaceholder')}
            />
            <Text style={styles.times}>×</Text>
            <TextInput
              style={[styles.input, styles.accessorySmall]}
              placeholder={t('blockBuilder.accessoryRepsPlaceholder')}
              placeholderTextColor={c.textMuted}
              value={acc.reps}
              onChangeText={(v) => updateAccessory(dow, i, { reps: v })}
              accessibilityLabel={t('blockBuilder.accessoryRepsPlaceholder')}
            />
            <Pressable
              hitSlop={8}
              onPress={() => removeAccessory(dow, i)}
              accessibilityRole="button"
              accessibilityLabel={t('blockBuilder.scheduleRemoveAccessoryButton')}
            >
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} onPress={() => addAccessory(dow)}>
          <Text style={styles.addText}>{t('blockBuilder.scheduleAddAccessoryButton')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderPage(dow: Weekday) {
    const day = dayOf(dow);
    return (
      <View key={dow} style={[styles.page, { width }]}>
        <View style={styles.pageHeader}>
          <Text style={styles.dayTitle}>{capitalize(weekdayLabel(dow, language, 'long'))}</Text>
          {day && (
            <Pressable hitSlop={8} onPress={() => patchDay(dow, () => null)} accessibilityRole="button">
              <Text style={styles.removeText}>{t('blockBuilder.scheduleRemoveDayButton')}</Text>
            </Pressable>
          )}
        </View>
        {day ? renderSession(dow, day) : renderRestDay(dow)}
      </View>
    );
  }

  function renderPicker(target: PickerTarget) {
    const current = target.index == null ? null : dayOf(target.dayOfWeek)?.variations[target.index];
    const groups = LIFTING_EXERCISES.map((exercise) => ({
      exercise,
      items: variationsForExercise(exercise).filter((v) =>
        matchesSearch(query, [t(`activities.${exercise}`), t(`blockVariations.${v.id}.label`)])
      ),
    })).filter((g) => g.items.length > 0);
    return (
      <View style={styles.pickerBox}>
        <Text style={styles.pickerTitle}>
          {t('blockBuilder.variationPickerTitle', { day: capitalize(weekdayLabel(target.dayOfWeek, language, 'long')) })}
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder={t('blockBuilder.variationSearchPlaceholder')}
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="done"
          />
          <Pressable hitSlop={8} onPress={() => setPicker(null)} accessibilityRole="button">
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.pageScroll}>
          {groups.length === 0 && <Text style={styles.restText}>{t('blockBuilder.variationSearchEmpty')}</Text>}
          {groups.map((g) => (
            <View key={g.exercise}>
              <Text style={styles.groupTitle}>{t(`activities.${g.exercise}`)}</Text>
              {g.items.map((v) => {
                const selected = current?.variationId === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => pick(v)}
                    style={({ pressed }) => [styles.pickRow, selected && styles.pickRowSelected, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.pickText, selected && styles.pickTextSelected]}>
                      {t(`blockVariations.${v.id}.label`)}
                    </Text>
                    {selected && <Text style={styles.pickTextSelected}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {renderStrip()}
      <View style={styles.window} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {picker ? (
          renderPicker(picker)
        ) : width > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: page * width, y: 0 }}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {WEEK_ORDER.map(renderPage)}
          </ScrollView>
        ) : null}
      </View>
      {!picker && <Text style={styles.swipeHint}>{t('blockBuilder.scheduleSwipeHint')}</Text>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 8 },
    strip: { flexDirection: 'row', gap: 4 },
    stripDay: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      gap: 3,
    },
    stripDayActive: { borderColor: c.accent, backgroundColor: c.bgHighlight },
    stripText: { fontSize: 11, fontWeight: '600', color: c.textMuted },
    stripTextPlanned: { color: c.textBright },
    stripTextActive: { color: c.accent },
    stripDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
    stripDotPlanned: { backgroundColor: c.accent },
    stripDotWarn: { backgroundColor: c.danger },
    window: {
      height: PAGE_HEIGHT,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
      overflow: 'hidden',
    },
    page: { height: PAGE_HEIGHT, padding: 12, gap: 8 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayTitle: { fontSize: 16, fontWeight: '700', color: c.textBright },
    pageScroll: { flex: 1 },
    pageScrollContent: { gap: 8, paddingBottom: 8 },
    restBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    restText: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
    liftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
    },
    rolePill: {
      minWidth: 44,
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    rolePillMain: { backgroundColor: c.accent, borderColor: c.accent },
    rolePillText: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
    rolePillTextMain: { color: c.bg },
    liftName: { flex: 1 },
    liftExercise: { fontSize: 11, fontWeight: '700', color: c.textTertiary },
    liftVariation: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    removeX: { color: c.danger, fontSize: 14, fontWeight: '700', paddingHorizontal: 2 },
    removeText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textSoft, marginTop: 4 },
    accessoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 8,
      fontSize: 14,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    accessoryName: { flex: 3 },
    accessorySmall: { flex: 1, textAlign: 'center' },
    times: { color: c.textMuted, fontSize: 13 },
    addBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
    },
    addText: { color: c.infoAlt, fontSize: 12, fontWeight: '700' },
    addDayBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: c.accent },
    addDayText: { color: c.bg, fontSize: 13, fontWeight: '700' },
    templateBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.accentAltBg,
      borderWidth: 1,
      borderColor: c.accentAlt,
    },
    templateBtnText: { color: c.accentAltLight, fontSize: 12, fontWeight: '700' },
    swipeHint: { color: c.textMuted, fontSize: 11, textAlign: 'center' },
    pickerBox: { flex: 1, padding: 12, gap: 8 },
    pickerTitle: { fontSize: 13, fontWeight: '700', color: c.textSoft },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchInput: { flex: 1 },
    cancelText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    groupTitle: { fontSize: 11, fontWeight: '700', color: c.textTertiary, marginTop: 8, marginBottom: 2 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    pickRowSelected: { backgroundColor: c.bgElevated },
    pickText: { flex: 1, fontSize: 14, color: c.textPrimary },
    pickTextSelected: { color: c.accent, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });
