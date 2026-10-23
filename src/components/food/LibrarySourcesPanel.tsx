import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Dimensions, Switch, TextInput } from 'react-native';
import {
  getLibrarySources,
  setLibrarySourceEnabledAndRegister,
  deleteLibrarySourceAndUnregister,
} from '../../data/food/libraryFoodRegistry';
import {
  importLibraryFile,
  pickLibraryFile,
  readLibraryPreview,
  type LibraryImportProgress,
  type LibraryImportSummary,
  type LibraryPreview,
  type PickedLibraryFile,
} from '../../services/food/libraryImportService';
import {
  LIBRARY_EXTRA_FIELDS,
  LIBRARY_LIMIT_OPTIONS_MB,
  LIBRARY_MAIN_FIELDS,
  LIBRARY_REQUIRED_FIELDS,
  bytesToMb,
  libraryFileKind,
  libraryHardMaxMb,
  libraryRowToFood,
  librarySizeCheck,
  remapColumns,
} from '../../domain/food/library/libraryMapping';
import type { ColumnMapping, LibraryField, LibraryImportOptions, LibrarySource } from '../../types/foodLibrary';
import { useSettingsStore } from '../../store/settingsStore';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';
import { LOCALE_TAGS } from '../../i18n';

// "📚 Nguồn" tab of Món của tôi: the user's own food tables, imported from
// CSV or spreadsheet files — the app is the engine and the on-device store,
// the data stays theirs. Everything happens inside this one panel, each step
// replacing the previous one in place (no stacked sheets): list → map columns
// → importing → result. ↻ on a source imports a newer version of its file
// into the same source, starting from the saved mapping. Owner decisions
// (2026-10-23): imported rows are corrected via overrides, never edited in
// place; the user chooses the size limit (default 10 MB, a few hundred MB at
// most for CSV).

type Step =
  | { kind: 'list' }
  | {
      kind: 'mapping';
      file: PickedLibraryFile;
      preview: LibraryPreview;
      columns: ColumnMapping;
      options: LibraryImportOptions;
      name: string;
      // The field whose column is being chosen — the column list replaces
      // the field list while it is open.
      picking: LibraryField | null;
      showExtra: boolean;
      // Set when updating an existing source (↻) instead of adding one.
      replace?: LibrarySource;
    }
  | { kind: 'importing'; file: PickedLibraryFile; progress: LibraryImportProgress }
  | { kind: 'result'; summary: LibraryImportSummary };

const WINDOW_HEIGHT = Dimensions.get('window').height;
const LIST_HEIGHT = WINDOW_HEIGHT * 0.32;
const PREVIEW_ROWS = 3;

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

// Small equal-width segmented control (also used by MyFoodsSheet's tabs).
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  grow = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  // true inside a row: take the space next to the row's label.
  grow?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.segmented, grow && styles.segmentedGrow]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LibrarySourcesPanel() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const limitMb = useSettingsStore((s) => s.libraryImportLimitMb);
  const setLimitMb = useSettingsStore((s) => s.setLibraryImportLimitMb);

  const [step, setStep] = useState<Step>({ kind: 'list' });
  const [busy, setBusy] = useState(false);
  // Bumped after toggle/delete/import: the source list is a plain in-memory
  // array in libraryFoodRegistry, re-read on render.
  const [refreshTick, setRefreshTick] = useState(0);
  const cancelRef = useRef(false);

  void refreshTick;
  const sources = getLibrarySources();
  const fmt = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);
  const fieldLabel = (field: LibraryField) => t(`myFoods.library.fields.${field}`);

  function refresh() {
    setRefreshTick((n) => n + 1);
  }

  // ---- list actions -------------------------------------------------------

  function toggleSource(source: LibrarySource, enabled: boolean) {
    setLibrarySourceEnabledAndRegister(source.id, enabled).then(refresh);
  }

  function confirmDelete(source: LibrarySource) {
    Alert.alert(
      t('myFoods.library.deleteTitle'),
      t('myFoods.library.deleteMessage', { name: source.name, count: fmt(source.foodCount) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myFoods.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            deleteLibrarySourceAndUnregister(source.id).then(refresh);
          },
        },
      ]
    );
  }

  // Columns for a (new) preview: an update starts from the source's saved
  // mapping, matched by column name; a new source from the guess.
  function columnsFor(preview: LibraryPreview, replace?: LibrarySource): ColumnMapping {
    return replace?.mapping ? remapColumns(replace.mapping, preview.header) : preview.guess.columns;
  }

  function openMapping(file: PickedLibraryFile, preview: LibraryPreview, replace?: LibrarySource) {
    setStep({
      kind: 'mapping',
      file,
      preview,
      columns: columnsFor(preview, replace),
      options: replace?.mapping?.options ?? {
        basis: 'per100g',
        energyUnit: preview.guess.energyUnit,
        decimal: preview.decimal,
        mineralUnit: preview.guess.mineralUnit,
      },
      name: replace?.name ?? stripExtension(file.name),
      picking: null,
      showExtra: false,
      replace,
    });
  }

  function confirmUpdate(source: LibrarySource) {
    Alert.alert(
      t('myFoods.library.updateConfirmTitle', { name: source.name }),
      t('myFoods.library.updateConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('myFoods.library.updateConfirm'), onPress: () => handlePick(source) },
      ]
    );
  }

  async function handlePick(replace?: LibrarySource) {
    if (busy) return;
    setBusy(true);
    try {
      const file = await pickLibraryFile();
      if (!file) return;
      const kind = libraryFileKind(file.name);
      if (kind === 'other') {
        Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.unsupportedMessage'));
        return;
      }
      const sizeCheck = librarySizeCheck(file.size, limitMb, kind);
      if (sizeCheck === 'tooBig') {
        Alert.alert(
          t('myFoods.library.tooBigTitle'),
          t(kind === 'xlsx' ? 'myFoods.library.tooBigXlsxMessage' : 'myFoods.library.tooBigMessage', {
            mb: fmt(bytesToMb(file.size)),
            max: libraryHardMaxMb(kind),
          })
        );
        return;
      }
      const preview = await readLibraryPreview(file);
      if (!preview || preview.header.length < 2) {
        Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.unreadableMessage'));
        return;
      }
      if (sizeCheck === 'ask') {
        Alert.alert(
          t('myFoods.library.bigTitle'),
          t('myFoods.library.bigMessage', {
            mb: fmt(bytesToMb(file.size)),
            rows: fmt(preview.estimatedRows),
            limit: limitMb,
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('myFoods.library.bigContinue'), onPress: () => openMapping(file, preview, replace) },
          ]
        );
        return;
      }
      openMapping(file, preview, replace);
    } catch (e) {
      console.warn('Library file pick/preview failed:', e);
      Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.unreadableMessage'));
    } finally {
      setBusy(false);
    }
  }

  // Another worksheet of the same spreadsheet: re-read it and re-match the
  // columns; the unit options the user set stay.
  async function switchSheet(mapping: Extract<Step, { kind: 'mapping' }>, sheetName: string) {
    if (busy) return;
    setBusy(true);
    try {
      const preview = await readLibraryPreview(mapping.file, sheetName);
      if (!preview || preview.header.length < 2) {
        Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.unreadableMessage'));
        return;
      }
      setStep({ ...mapping, preview, columns: columnsFor(preview, mapping.replace), picking: null });
    } catch (e) {
      console.warn('Library sheet switch failed:', e);
      Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.unreadableMessage'));
    } finally {
      setBusy(false);
    }
  }

  // ---- import -------------------------------------------------------------

  async function runImport(mapping: Extract<Step, { kind: 'mapping' }>) {
    cancelRef.current = false;
    const { file } = mapping;
    setStep({ kind: 'importing', file, progress: { bytesRead: 0, totalBytes: file.size, rows: 0 } });
    try {
      const result = await importLibraryFile({
        file,
        sourceName: mapping.name,
        mapping: {
          format: mapping.preview.format,
          sheetName: mapping.preview.sheetName,
          delimiter: mapping.preview.delimiter,
          header: mapping.preview.header,
          columns: mapping.columns,
          options: mapping.options,
        },
        replace: mapping.replace,
        onProgress: (progress) => setStep({ kind: 'importing', file, progress }),
        isCancelled: () => cancelRef.current,
      });
      if (result === 'cancelled') {
        setStep({ kind: 'list' });
        return;
      }
      setStep({ kind: 'result', summary: result });
    } catch (e) {
      console.warn('Library import failed:', e);
      Alert.alert(t('myFoods.library.errorTitle'), t('myFoods.library.importFailedMessage'));
      setStep({ kind: 'list' });
    } finally {
      refresh();
    }
  }

  // ---- render: list -------------------------------------------------------

  if (step.kind === 'list') {
    return (
      <View style={styles.wrap}>
        <ScrollView style={[styles.list, { maxHeight: LIST_HEIGHT }]} nestedScrollEnabled>
          {sources.length === 0 ? (
            <Text style={styles.empty}>{t('myFoods.library.empty')}</Text>
          ) : (
            sources.map((source) => (
              <View key={source.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {source.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {t('myFoods.library.rowMeta', { count: fmt(source.foodCount), file: source.fileName })}
                  </Text>
                </View>
                <Switch
                  value={source.enabled}
                  onValueChange={(v) => toggleSource(source, v)}
                  accessibilityLabel={t('myFoods.library.toggleA11y', { name: source.name })}
                />
                <Pressable
                  hitSlop={10}
                  disabled={busy}
                  onPress={() => confirmUpdate(source)}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityLabel={t('myFoods.library.updateA11y', { name: source.name })}
                >
                  <Text style={styles.updateIcon}>↻</Text>
                </Pressable>
                <Pressable
                  hitSlop={10}
                  onPress={() => confirmDelete(source)}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityLabel={t('myFoods.library.deleteTitle')}
                >
                  <Text style={styles.deleteIcon}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <Text style={styles.label}>{t('myFoods.library.limitLabel')}</Text>
        <Seg
          options={LIBRARY_LIMIT_OPTIONS_MB.map((mb) => ({ value: mb as number, label: t('myFoods.library.limitOption', { mb }) }))}
          value={limitMb}
          onChange={setLimitMb}
        />

        <Pressable
          disabled={busy}
          onPress={() => handlePick()}
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('myFoods.library.importButton')}</Text>
        </Pressable>
        <Text style={styles.hint}>{t('myFoods.library.importHint')}</Text>
      </View>
    );
  }

  // ---- render: importing --------------------------------------------------

  if (step.kind === 'importing') {
    const { progress } = step;
    const ratio = progress.totalBytes > 0 ? Math.min(1, progress.bytesRead / progress.totalBytes) : 0;
    return (
      <View style={styles.wrap}>
        <Text style={styles.fileName} numberOfLines={1}>
          {step.file.name}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
        <Text style={styles.rowMeta}>
          {t('myFoods.library.progress', { percent: Math.round(ratio * 100), rows: fmt(progress.rows) })}
        </Text>
        <Pressable
          onPress={() => {
            cancelRef.current = true;
          }}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  // ---- render: result -----------------------------------------------------

  if (step.kind === 'result') {
    const { summary } = step;
    const issues = (Object.keys(summary.skipped) as (keyof typeof summary.skipped)[]).filter(
      (k) => summary.skipped[k] > 0
    );
    return (
      <View style={styles.wrap}>
        <Text style={styles.resultTitle}>
          {summary.stored === 0
            ? t('myFoods.library.resultNone')
            : summary.previousCount !== undefined
              ? t('myFoods.library.resultUpdated', {
                  name: summary.source.name,
                  count: fmt(summary.stored),
                  before: fmt(summary.previousCount),
                })
              : t('myFoods.library.resultStored', { count: fmt(summary.stored), name: summary.source.name })}
        </Text>
        {issues.map((issue) => (
          <Text key={issue} style={styles.rowMeta}>
            {t('myFoods.library.resultSkipped', {
              count: fmt(summary.skipped[issue]),
              reason: t(`myFoods.library.issues.${issue}`),
            })}
          </Text>
        ))}
        {summary.adjusted > 0 ? (
          <Text style={styles.rowMeta}>{t('myFoods.library.resultAdjusted', { count: fmt(summary.adjusted) })}</Text>
        ) : null}
        <Pressable
          onPress={() => setStep({ kind: 'list' })}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('myFoods.library.done')}</Text>
        </Pressable>
      </View>
    );
  }

  // ---- render: mapping ----------------------------------------------------

  const m = step;
  const update = (patch: Partial<typeof m>) => setStep({ ...m, ...patch });
  const setOption = <K extends keyof LibraryImportOptions>(key: K, value: LibraryImportOptions[K]) =>
    update({ options: { ...m.options, [key]: value } });
  const columnName = (field: LibraryField) => {
    const col = m.columns[field];
    return col === undefined ? '—' : m.preview.header[col] || `#${col + 1}`;
  };
  const missingRequired = LIBRARY_REQUIRED_FIELDS.filter((f) => m.columns[f] === undefined);
  const needsServing = m.options.basis === 'perServing' && m.columns.servingG === undefined;
  const canImport = missingRequired.length === 0 && !needsServing && m.name.trim() !== '';

  if (m.picking !== null) {
    const field = m.picking;
    const firstRow = m.preview.sampleRows[0] ?? [];
    const choose = (col: number | undefined) => {
      const columns: ColumnMapping = { ...m.columns };
      if (col === undefined) delete columns[field];
      else columns[field] = col;
      update({ columns, picking: null });
    };
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{t('myFoods.library.pickColumnTitle', { field: fieldLabel(field) })}</Text>
        <ScrollView style={[styles.list, { maxHeight: WINDOW_HEIGHT * 0.42 }]} nestedScrollEnabled>
          <Pressable onPress={() => choose(undefined)} style={({ pressed }) => [styles.fieldRow, pressed && styles.pressed]}>
            <Text style={styles.rowName}>{t('myFoods.library.noColumn')}</Text>
          </Pressable>
          {m.preview.header.map((h, col) => (
            <Pressable
              key={`${col}-${h}`}
              onPress={() => choose(col)}
              style={({ pressed }) => [
                styles.fieldRow,
                m.columns[field] === col && styles.fieldRowActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.rowName} numberOfLines={1}>
                {h || `#${col + 1}`}
              </Text>
              <Text style={styles.sampleValue} numberOfLines={1}>
                {firstRow[col] ?? ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => update({ picking: null })} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  const previewRows = m.preview.sampleRows.slice(0, PREVIEW_ROWS).map((cells) =>
    libraryRowToFood(cells, m.columns, m.options, 'preview')
  );
  const fieldRow = (field: LibraryField) => (
    <Pressable
      key={field}
      onPress={() => update({ picking: field })}
      style={({ pressed }) => [styles.fieldRow, pressed && styles.pressed]}
    >
      <Text style={styles.fieldLabel} numberOfLines={1}>
        {fieldLabel(field)}
        {LIBRARY_REQUIRED_FIELDS.includes(field) ? ' *' : ''}
      </Text>
      <Text style={[styles.fieldValue, m.columns[field] === undefined && styles.fieldValueEmpty]} numberOfLines={1}>
        {columnName(field)} ▾
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {m.replace ? (
        <Text style={styles.label} numberOfLines={1}>
          {t('myFoods.library.updateTitle', { name: m.replace.name })}
        </Text>
      ) : null}
      <Text style={styles.fileName} numberOfLines={1}>
        {m.file.name}
      </Text>
      <Text style={styles.rowMeta}>
        {t('myFoods.library.fileMeta', { mb: fmt(bytesToMb(m.file.size)), rows: fmt(m.preview.estimatedRows) })}
      </Text>
      {m.preview.sheetNames.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetStrip}>
          {m.preview.sheetNames.map((sheet) => {
            const active = sheet === m.preview.sheetName;
            return (
              <Pressable
                key={sheet}
                disabled={busy || active}
                onPress={() => switchSheet(m, sheet)}
                style={({ pressed }) => [styles.sheetChip, active && styles.sheetChipActive, pressed && styles.pressed]}
                accessibilityLabel={t('myFoods.library.sheetA11y', { name: sheet })}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.sheetChipText, active && styles.segmentTextActive]} numberOfLines={1}>
                  {sheet}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        style={[styles.list, { maxHeight: WINDOW_HEIGHT * 0.46 }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t('myFoods.library.sourceName')}</Text>
        <TextInput
          value={m.name}
          onChangeText={(name) => update({ name })}
          style={styles.input}
          placeholder={t('myFoods.library.sourceNamePlaceholder')}
          placeholderTextColor={styles.placeholder.color}
          maxLength={40}
        />

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel} numberOfLines={1} adjustsFontSizeToFit>{t('myFoods.library.basisLabel')}</Text>
          <Seg
            options={[
              { value: 'per100g', label: t('myFoods.library.basisPer100g') },
              { value: 'perServing', label: t('myFoods.library.basisPerServing') },
            ]}
            value={m.options.basis}
            onChange={(v) => setOption('basis', v)}
            grow
          />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel} numberOfLines={1} adjustsFontSizeToFit>{t('myFoods.library.energyLabel')}</Text>
          <Seg
            options={[
              { value: 'kcal', label: 'kcal' },
              { value: 'kj', label: 'kJ' },
            ]}
            value={m.options.energyUnit}
            onChange={(v) => setOption('energyUnit', v)}
            grow
          />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel} numberOfLines={1} adjustsFontSizeToFit>{t('myFoods.library.decimalLabel')}</Text>
          <Seg
            options={[
              { value: '.', label: '1.5' },
              { value: ',', label: '1,5' },
            ]}
            value={m.options.decimal}
            onChange={(v) => setOption('decimal', v)}
            grow
          />
        </View>

        <Text style={styles.label}>{t('myFoods.library.columnsTitle')}</Text>
        {LIBRARY_MAIN_FIELDS.map(fieldRow)}
        <Pressable
          onPress={() => update({ showExtra: !m.showExtra })}
          style={({ pressed }) => [styles.foldBtn, pressed && styles.pressed]}
        >
          <Text style={styles.foldText}>
            {m.showExtra ? t('myFoods.library.extraHide') : t('myFoods.library.extraShow')}
          </Text>
        </Pressable>
        {m.showExtra ? (
          <>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel} numberOfLines={1} adjustsFontSizeToFit>{t('myFoods.library.mineralLabel')}</Text>
              <Seg
                options={[
                  { value: 'mg', label: 'mg' },
                  { value: 'g', label: 'g' },
                ]}
                value={m.options.mineralUnit}
                onChange={(v) => setOption('mineralUnit', v)}
                grow
              />
            </View>
            {LIBRARY_EXTRA_FIELDS.map(fieldRow)}
          </>
        ) : null}

        <Text style={styles.label}>{t('myFoods.library.previewTitle')}</Text>
        {previewRows.map((r, i) => (
          <Text key={i} style={styles.previewLine} numberOfLines={1}>
            {r.ok
              ? t('myFoods.library.previewRow', {
                  name: r.item.nameVi,
                  kcal: fmt(Math.round(r.item.per100g.energyKcal)),
                  p: fmt(r.item.per100g.proteinG),
                  f: fmt(r.item.per100g.fatG),
                  c: fmt(r.item.per100g.carbG),
                })
              : `⚠ ${t(`myFoods.library.issues.${r.issue}`)}`}
          </Text>
        ))}
      </ScrollView>

      {!canImport ? (
        <Text style={styles.warn}>
          {missingRequired.length > 0
            ? t('myFoods.library.needRequired', { fields: missingRequired.map(fieldLabel).join(', ') })
            : needsServing
              ? t('myFoods.library.needServing')
              : t('myFoods.library.needName')}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <Pressable onPress={() => setStep({ kind: 'list' })} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          disabled={!canImport}
          onPress={() => runImport(m)}
          style={({ pressed }) => [styles.primaryBtnFlex, (!canImport || pressed) && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('myFoods.library.importConfirm')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    list: { flexGrow: 0 },
    empty: { fontSize: 12, color: c.textTertiary, lineHeight: 18, paddingVertical: 8 },
    hint: { fontSize: 11, color: c.textSubtle, lineHeight: 16 },
    label: { fontSize: 12, fontWeight: '700', color: c.textSecondary, marginTop: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    rowMain: { flex: 1, gap: 2 },
    rowName: { fontSize: 14, color: c.textBright, fontWeight: '500', flexShrink: 1 },
    rowMeta: { fontSize: 11, color: c.textSubtle },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteIcon: { color: c.danger, fontSize: 14, fontWeight: '700' },
    updateIcon: { color: c.infoAlt, fontSize: 15, fontWeight: '700' },
    sheetStrip: { gap: 6, paddingVertical: 2 },
    sheetChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: 160,
    },
    sheetChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    sheetChipText: { fontSize: 12, color: c.textLight, fontWeight: '600' },
    segmented: {
      flexDirection: 'row',
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 2,
      gap: 2,
    },
    segmentedGrow: { flex: 1 },
    segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 12, color: c.textLight, fontWeight: '600' },
    segmentTextActive: { color: c.onAccent },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
    optionLabel: { width: 110, fontSize: 12, color: c.textSecondary },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 40,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    fieldRowActive: { borderBottomColor: c.accent },
    fieldLabel: { flex: 1, fontSize: 13, color: c.textLight },
    fieldValue: { flex: 1, fontSize: 13, color: c.textBright, fontWeight: '600', textAlign: 'right' },
    fieldValueEmpty: { color: c.textTertiary, fontWeight: '400' },
    sampleValue: { flex: 1, fontSize: 12, color: c.textSubtle, textAlign: 'right' },
    foldBtn: { paddingVertical: 10, alignItems: 'center' },
    foldText: { fontSize: 13, color: c.accent, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: c.textBright,
      backgroundColor: c.bgElevated,
      fontSize: 14,
    },
    placeholder: { color: c.textTertiary },
    previewLine: { fontSize: 12, color: c.textSecondary, paddingVertical: 2 },
    fileName: { fontSize: 14, color: c.textBright, fontWeight: '700' },
    warn: { fontSize: 11, color: c.warning },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.bgElevated, overflow: 'hidden' },
    progressFill: { height: 8, backgroundColor: c.accent },
    resultTitle: { fontSize: 14, color: c.textBright, fontWeight: '600', lineHeight: 20 },
    footerRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    actionText: { color: c.textLight, fontSize: 13, fontWeight: '600' },
    primaryBtn: { paddingVertical: 12, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' },
    primaryBtnFlex: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' },
    primaryText: { color: c.onAccent, fontSize: 13, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });
