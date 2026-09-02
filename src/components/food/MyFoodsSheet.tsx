import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Dimensions } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { FoodNutritionEditModal } from '../FoodNutritionEditModal';
import {
  getCustomFoods,
  deleteCustomFoodAndUnregister,
} from '../../data/food/customFoodRegistry';
import {
  getAllOverridesSync,
  deleteOverrideAndUnregister,
} from '../../data/food/foodOverrideRegistry';
import { foodDisplayName } from '../../data/food/foodLookup';
import { nutritionBasisLabel } from '../../domain/food/portionUnits';
import { foodCategoryLabel } from '../../lib/constants';
import {
  exportMyFoods,
  importMyFoods,
  listBackupFiles,
  type BackupFile,
} from '../../services/food/myFoodsBackupService';
import type { FoodItem } from '../../types/food';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

// "Món của tôi": the only screen where the user can SEE and manage the food
// list they built up. Custom foods and catalog corrections were previously
// write-only — addable from the log/quick-log flows, but with no way to review
// them, fix a typo in a name, or remove one. This closes that loop, and adds
// the export/import that makes the effort survive a lost phone.
//
// Deleting is deliberately non-destructive to history: food_log rows keep
// their own snapshotted nutrition and their frozen foodNameVi, so a deleted
// food never rewrites what was already eaten (see foodLogEntryDisplayName).

interface Props {
  visible: boolean;
  onClose: () => void;
}

const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.45;

export function MyFoodsSheet({ visible, onClose }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);

  // Bumped after every add/edit/delete/import so the lists below re-read the
  // registries — they are plain in-memory arrays, not reactive stores.
  const [refreshTick, setRefreshTick] = useState(0);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[] | null>(null);

  // Read during render like SupplementQuickLog does: synchronous in-memory
  // reads, re-run whenever refreshTick changes.
  void refreshTick;
  const customFoods = getCustomFoods();
  const overrides = getAllOverridesSync();

  function refresh() {
    setRefreshTick((n) => n + 1);
  }

  function confirmDeleteCustom(item: FoodItem) {
    Alert.alert(
      t('myFoods.deleteTitle'),
      t('myFoods.deleteCustomMessage', { name: foodDisplayName(item, language) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myFoods.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            deleteCustomFoodAndUnregister(item.id).then(refresh);
          },
        },
      ]
    );
  }

  function confirmDeleteOverride(item: FoodItem) {
    Alert.alert(
      t('myFoods.deleteTitle'),
      t('myFoods.deleteOverrideMessage', { name: foodDisplayName(item, language) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myFoods.revertConfirm'),
          style: 'destructive',
          onPress: () => {
            deleteOverrideAndUnregister(item.id).then(refresh);
          },
        },
      ]
    );
  }

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await exportMyFoods(language);
      Alert.alert(
        t('myFoods.export.doneTitle'),
        t('myFoods.export.doneMessage', {
          custom: result.customFoodCount,
          override: result.overrideCount,
        })
      );
    } catch (e) {
      console.warn('exportMyFoods failed:', e);
      Alert.alert(t('common.error'), t('myFoods.export.errorMessage'));
    } finally {
      setBusy(false);
    }
  }

  async function handleShowImportPicker() {
    if (busy) return;
    setBusy(true);
    try {
      const files = await listBackupFiles();
      setBackupFiles(files);
    } catch (e) {
      console.warn('listBackupFiles failed:', e);
      setBackupFiles([]);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: BackupFile) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await importMyFoods(file.uri);
      if ('ok' in result) {
        // Rejected: the domain layer hands back a reason KEY, not a message,
        // so it stays translatable here.
        Alert.alert(t('myFoods.import.errorTitle'), t(`myFoods.import.${result.reasonKey}`));
        return;
      }
      setBackupFiles(null);
      refresh();
      Alert.alert(
        t('myFoods.import.doneTitle'),
        t('myFoods.import.doneMessage', {
          custom: result.customFoodsImported,
          override: result.overridesImported,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  function renderRow(item: FoodItem, onDelete: (item: FoodItem) => void) {
    return (
      <View key={item.id} style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {foodDisplayName(item, language)}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {foodCategoryLabel(item.category, language)} ·{' '}
            {t('myFoods.rowBasis', {
              basis: nutritionBasisLabel(
                item.portionUnit,
                item.servingLabel,
                item.measureUnit,
                language
              ),
            })}
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => setEditingFood(item)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.editIcon}>✎</Text>
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => onDelete(item)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.deleteIcon}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={560}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('myFoods.title')}</Text>
        <Text style={styles.subtitle}>{t('myFoods.subtitle')}</Text>

        {backupFiles !== null ? (
          <>
            <Text style={styles.sectionTitle}>{t('myFoods.import.pickTitle')}</Text>
            <Text style={styles.hint}>{t('myFoods.import.pickHint')}</Text>
            <ScrollView style={[styles.list, { maxHeight: MAX_LIST_HEIGHT }]}>
              {backupFiles.length === 0 ? (
                <Text style={styles.empty}>{t('myFoods.import.noFiles')}</Text>
              ) : (
                backupFiles.map((file) => (
                  <Pressable
                    key={file.uri}
                    disabled={busy}
                    onPress={() => handleImport(file)}
                    style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              onPress={() => setBackupFiles(null)}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{t('common.cancel')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ScrollView style={[styles.list, { maxHeight: MAX_LIST_HEIGHT }]}>
              <Text style={styles.sectionTitle}>
                {t('myFoods.customSectionTitle', { count: customFoods.length })}
              </Text>
              {customFoods.length === 0 ? (
                <Text style={styles.empty}>{t('myFoods.emptyCustom')}</Text>
              ) : (
                customFoods.map((item) => renderRow(item, confirmDeleteCustom))
              )}

              <Text style={styles.sectionTitle}>
                {t('myFoods.overrideSectionTitle', { count: overrides.length })}
              </Text>
              {overrides.length === 0 ? (
                <Text style={styles.empty}>{t('myFoods.emptyOverride')}</Text>
              ) : (
                overrides.map((item) => renderRow(item, confirmDeleteOverride))
              )}
            </ScrollView>

            <View style={styles.footerRow}>
              <Pressable
                disabled={busy}
                onPress={handleExport}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>{t('myFoods.export.button')}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={handleShowImportPicker}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>{t('myFoods.import.button')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <FoodNutritionEditModal
        visible={editingFood !== null}
        mode="edit"
        initialFood={editingFood ?? undefined}
        onClose={() => setEditingFood(null)}
        onSaved={refresh}
      />
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  content: { padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 12, color: c.textSubtle, lineHeight: 17, marginTop: -6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginTop: 12 },
  hint: { fontSize: 11, color: c.textSubtle, lineHeight: 16 },
  list: { flexGrow: 0 },
  empty: { fontSize: 12, color: c.textTertiary, lineHeight: 18, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, color: c.textBright, fontWeight: '500' },
  rowMeta: { fontSize: 11, color: c.textSubtle },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: { color: c.infoAlt, fontSize: 13, fontWeight: '700' },
  deleteIcon: { color: c.danger, fontSize: 14, fontWeight: '700' },
  fileRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  fileName: { fontSize: 13, color: c.textSecondary },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
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
  pressed: { opacity: 0.6 },
});
