import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import {
  blockTrainingMax,
  buildFormRows,
  formatFormText,
  formLifts,
  resolvePercents,
  setGroups,
} from '../../domain/energy/blockForm';
import type { FormLift, FormRow } from '../../domain/energy/blockForm';
import type { VariationAddress } from '../../domain/energy/blockPlanEdits';
import { parseSetNotation } from '../../domain/training/setNotation';
import { weekdayLabel } from '../../lib/dateUtils';
import { LOCALE_TAGS } from '../../i18n/types';
import type { LiftingSet } from '../../types/energy';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  plan: GeneratedBlockPlan;
  currentWeekIndex: number;
  weekLabel: (weekIndex: number) => string; // "B3W2"
  lifted: Set<string>; // days that hold a lifting Xả — trained rows go green
  onSaveRows: (edits: { at: VariationAddress; sets: LiftingSet[] }[]) => Promise<void>;
  onSetTrainingMax: (lift: FormLift, kg: number) => Promise<void>;
}

// The rows scroll inside a window this tall.
const ROWS_MAX_HEIGHT = 420;
const LABEL_W = 58;

const keyOf = (at: VariationAddress) => `${at.weekIndex}.${at.dayIndex}.${at.variationIndex}`;

type Parsed = { ok: true; sets: LiftingSet[] } | { ok: false; error: string };

// "Form" — the owner's spreadsheet: one lift, its TM on top, a row per session
// "sets x reps @ weight" with each weight's % of the TM (blockForm.ts).
export function BlockFormView(props: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const lifts = formLifts(props.plan);
  const [picked, setPicked] = useState<string | null>(null);
  const lift = lifts.find((l) => l.variationId === picked) ?? lifts[0];

  if (!lift) return <Text style={styles.hint}>{t('planAppendix.liftGrid.empty')}</Text>;

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {lifts.map((l) => {
          const active = l.variationId === lift.variationId;
          return (
            <Pressable
              key={l.variationId}
              onPress={() => setPicked(l.variationId)}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`blockVariations.${l.variationId}.label`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Remounted per lift, so a half-typed row never carries over. */}
      <LiftForm key={lift.variationId} {...props} lift={lift} />
    </View>
  );
}

function LiftForm({
  plan,
  lift,
  currentWeekIndex,
  weekLabel,
  lifted,
  onSaveRows,
  onSetTrainingMax,
}: Props & { lift: FormLift }) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const num = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);
  const liftName = t(`blockVariations.${lift.variationId}.label`);

  const tm = blockTrainingMax(plan, lift.variationId, lift.exercise);
  const rows = buildFormRows(plan, lift.variationId, lifted);
  const [tmText, setTmText] = useState(() => num(tm));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showInfo, setShowInfo] = useState(false);

  const tmTyped = Number(tmText.replace(',', '.').trim());
  const tmValid = tmText.trim() !== '' && Number.isFinite(tmTyped) && tmTyped > 0 && tmTyped <= 1000;
  const tmChanged = tmValid && tmTyped !== tm;
  const dirty = Object.keys(drafts).length;

  const parsed = useMemo(() => {
    const out: Record<string, Parsed> = {};
    for (const [key, text] of Object.entries(drafts)) {
      const kgText = resolvePercents(text, tm);
      if (kgText == null) {
        out[key] = { ok: false, error: t('planAppendix.form.noTm') };
        continue;
      }
      const r = parseSetNotation(kgText);
      out[key] = r.ok
        ? r
        : {
            ok: false,
            error:
              r.badToken === ''
                ? t('planAppendix.editSheet.emptyError')
                : t('planAppendix.editSheet.parseError', { token: r.badToken }),
          };
    }
    return out;
  }, [drafts, tm, t]);
  const allValid = Object.values(parsed).every((p) => p.ok);

  function save() {
    const edits = rows.flatMap((r) => {
      const p = parsed[keyOf(r.at)];
      return p && p.ok ? [{ at: r.at, sets: p.sets }] : [];
    });
    onSaveRows(edits).then(() => setDrafts({}));
  }

  function rowLabel(r: FormRow) {
    const week = weekLabel(r.weekIndex);
    return r.sameWeekCount > 1 ? `${week} ${weekdayLabel(r.dayOfWeek, language, 'short')}` : week;
  }

  function renderGroups(sets: LiftingSet[]) {
    return setGroups(sets, tm).map((g, i) => (
      <Text key={i} style={styles.group}>
        {g.prime ? `${num(g.weightKg)} +` : `${g.sets}×${g.reps} @ ${num(g.weightKg)}`}
        {g.pct != null && !g.prime ? <Text style={styles.pct}> {num(g.pct)}%</Text> : null}
      </Text>
    ));
  }

  function renderRow(r: FormRow) {
    const key = keyOf(r.at);
    const now = r.weekIndex === currentWeekIndex;
    if (r.state === 'skipped') {
      return (
        <View key={key} style={[styles.row, styles.rowOff]}>
          <Text style={[styles.rowHead, now && styles.rowHeadNow]}>{rowLabel(r)}</Text>
          <Text style={styles.offText}>{t('planAppendix.form.off')}</Text>
        </View>
      );
    }
    const draft = drafts[key];
    const p = parsed[key];
    const shown = p && p.ok ? p.sets : r.sets;
    return (
      <View key={key} style={[styles.row, r.state === 'done' && styles.rowDone]}>
        <Text style={[styles.rowHead, now && styles.rowHeadNow]}>
          {rowLabel(r)}
          {r.userEdited ? <Text style={styles.edited}> ✎</Text> : null}
        </Text>
        <View style={styles.rowBody}>
          <TextInput
            style={[styles.input, draft != null && styles.inputDirty, p && !p.ok && styles.inputError]}
            value={draft ?? formatFormText(r.sets, language)}
            onChangeText={(text) => setDrafts((d) => ({ ...d, [key]: text }))}
            accessibilityLabel={t('planAppendix.form.rowA11y', { lift: liftName, week: rowLabel(r) })}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            placeholderTextColor={c.textMuted}
          />
          {p && !p.ok ? (
            <Text style={styles.errorText}>{p.error}</Text>
          ) : (
            <View style={styles.groups}>{renderGroups(shown)}</View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.tmRow}>
        <Text style={styles.tmLabel}>{t('planAppendix.form.tmLabel')}</Text>
        <TextInput
          style={[styles.tmInput, !tmValid && styles.inputError]}
          value={tmText}
          onChangeText={setTmText}
          keyboardType="decimal-pad"
          accessibilityLabel={t('planAppendix.form.tmA11y', { lift: liftName })}
        />
        <Text style={styles.tmUnit}>{t('planAppendix.form.tmUnit')}</Text>
        <Pressable
          disabled={!tmChanged || dirty > 0}
          onPress={() => onSetTrainingMax(lift, tmTyped)}
          style={({ pressed }) => [styles.applyBtn, (!tmChanged || dirty > 0) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.applyText}>{t('planAppendix.form.tmApply')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowInfo((v) => !v)}
          style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('planAppendix.form.infoA11y')}
          accessibilityState={{ expanded: showInfo }}
        >
          <Text style={styles.infoGlyph}>ⓘ</Text>
        </Pressable>
      </View>
      {tmChanged && <Text style={styles.hint}>{dirty > 0 ? t('planAppendix.form.saveFirst') : t('planAppendix.form.tmHint')}</Text>}
      {showInfo && <Text style={styles.hint}>{t('planAppendix.form.info')}</Text>}

      <ScrollView style={styles.window} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <View style={styles.rows}>{rows.map(renderRow)}</View>
      </ScrollView>

      {dirty > 0 && (
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={() => setDrafts({})}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            disabled={!allValid}
            style={({ pressed }) => [styles.btn, styles.confirm, !allValid && styles.disabled, pressed && styles.pressed]}
            onPress={save}
          >
            <Text style={styles.confirmText}>{t('planAppendix.form.save', { count: dirty })}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 10 },
    chipRow: { gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: c.onAccent },
    hint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    tmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tmLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    tmInput: {
      width: 84,
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 16,
      fontWeight: '700',
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
      textAlign: 'center',
    },
    tmUnit: { color: c.textSecondary, fontSize: 13 },
    applyBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: c.accent },
    applyText: { color: c.onAccent, fontSize: 13, fontWeight: '800' },
    infoBtn: { marginLeft: 'auto', padding: 6 },
    infoGlyph: { color: c.textTertiary, fontSize: 18 },
    window: { maxHeight: ROWS_MAX_HEIGHT },
    rows: { gap: 6 },
    row: {
      flexDirection: 'row',
      gap: 8,
      padding: 8,
      borderRadius: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    rowDone: { backgroundColor: c.planDoneBg, borderColor: c.planDoneBorder },
    rowOff: { backgroundColor: c.planSkippedBg, borderColor: c.planSkippedBg, opacity: 0.75, alignItems: 'center' },
    rowHead: { width: LABEL_W, color: c.textSecondary, fontSize: 12, fontWeight: '800', paddingTop: 8 },
    rowHeadNow: { color: c.accent },
    rowBody: { flex: 1, gap: 4 },
    edited: { color: c.accent },
    offText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 10,
      fontSize: 14,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    inputDirty: { borderColor: c.accent },
    inputError: { borderColor: c.danger },
    errorText: { fontSize: 11, color: c.danger, lineHeight: 15 },
    groups: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
    group: { color: c.textPrimary, fontSize: 12, fontWeight: '600' },
    pct: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });
