import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { parseSetNotation } from '../../domain/training/setNotation';
import { formatSetSequence } from '../../domain/training/trainingLogFormatter';
import { liftingSessionKcal } from '../../domain/energy/liftingEngine';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import type { LiftingExercise, LiftingSet } from '../../types/energy';
import type { ResolvedVariationPlan, VariationReference } from '../../types/powerliftingBlock';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  variation: ResolvedVariationPlan;
  reference: VariationReference;
  bodyWeightKg: number;
  heightCm: number;
  onSave: (sets: LiftingSet[]) => void;
  onRestore: () => void; // back to the app's suggestion
  onCancel: () => void;
}

// The user's own plan for one variation in one week, typed in their Notes
// shorthand ("110x1 5x5x95"). A live preview shows exactly which sets the app
// read, so nothing ambiguous is saved silently. Shared by the ✎ sheet (by
// week) and the inline editor under the "Theo bài" grid; the parent remounts
// it (via `key`) for every variation it edits.
export function VariationSetsEditor({ variation, reference, bodyWeightKg, heightCm, onSave, onRestore, onCancel }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  // The plan always writes its prime ("95 + 4x6x72.5") and never the ramp.
  const userFormat = useTrainingLogFormat();
  const format = useMemo(() => ({ ...userFormat, showPrime: true, showWarmups: false }), [userFormat]);
  const exercise: LiftingExercise = variation.variation.exercise;

  const [text, setText] = useState(() => formatSetSequence(variation.sets, format, language));
  const parsed = useMemo(() => parseSetNotation(text), [text]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;
    const heaviest = Math.max(0, ...parsed.sets.filter((s) => s.kind === 'working').map((s) => s.weightKg));
    const max = reference.oneRepMaxKg * reference.loadFactor;
    return {
      kcal: liftingSessionKcal(exercise, parsed.sets, bodyWeightKg, heightCm),
      pct: max > 0 ? Math.round((heaviest / max) * 100) : 0,
    };
  }, [parsed, reference, exercise, bodyWeightKg, heightCm]);

  const error = parsed.ok
    ? null
    : parsed.badToken === ''
      ? t('planAppendix.editSheet.emptyError')
      : t('planAppendix.editSheet.parseError', { token: parsed.badToken });

  function save() {
    if (!parsed.ok) return;
    onSave(parsed.sets);
  }

  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('planAppendix.editSheet.inputLabel')}</Text>
        <TextInput
          style={[styles.input, error != null && styles.inputError]}
          placeholder={t('planAppendix.editSheet.placeholder')}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={t('planAppendix.editSheet.inputLabel')}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          value={text}
          onChangeText={setText}
        />
        <Text style={styles.hint}>{t('planAppendix.editSheet.hint')}</Text>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : parsed.ok && preview ? (
        <View style={styles.previewBox}>
          <Text style={styles.label}>{t('planAppendix.editSheet.previewTitle', { count: parsed.sets.length })}</Text>
          <Text style={styles.previewSets}>
            {parsed.sets
              .map((s) =>
                s.kind === 'warmup'
                  ? t('planAppendix.editSheet.previewPrimeLine', { weight: s.weightKg })
                  : t('planAppendix.editSheet.previewLine', { weight: s.weightKg, reps: s.reps })
              )
              .join(' · ')}
          </Text>
          <Text style={styles.hint}>{t('planAppendix.editSheet.previewSummary', preview)}</Text>
        </View>
      ) : null}

      <View style={styles.rowWrap}>
        <Pressable
          style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
          onPress={() => setText(formatSetSequence(reference.sets, format, language))}
        >
          <Text style={styles.chipBtnText}>{t('planAppendix.editSheet.copySuggestion')}</Text>
        </Pressable>
        {variation.userEdited && (
          <Pressable
            style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
            onPress={onRestore}
          >
            <Text style={styles.chipBtnText}>{t('planAppendix.editSheet.restoreSuggestion')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.row}>
        <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onCancel}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          disabled={!parsed.ok}
          style={({ pressed }) => [styles.btn, styles.confirm, !parsed.ok && styles.disabled, pressed && styles.pressed]}
          onPress={save}
        >
          <Text style={styles.confirmText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 14 },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '700', color: c.textBright },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
    errorText: { fontSize: 12, color: c.danger, lineHeight: 17 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    inputError: { borderColor: c.danger },
    previewBox: { gap: 4, padding: 10, borderRadius: 10, backgroundColor: c.bgHighlight },
    previewSets: { color: c.textPrimary, fontSize: 14, lineHeight: 20 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });
