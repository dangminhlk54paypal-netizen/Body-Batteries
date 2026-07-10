# S-S3 — DayDetailSheet component (2026-07-10)

## Summary

**Task:** Create a single new component `src/components/DayDetailSheet.tsx` — a bottom sheet UI to display food entries for a specific day, props-driven (no store/DB imports).

**Spec reference:** `.ai/parallel-reports/S-S-backfill-spec.md` § 3d + 3a (lối vào từ tab Lịch sử).

## Work Done

### File Created
- **`src/components/DayDetailSheet.tsx`** — 1 component file

### Implementation Details

**Props signature (matching spec 3d exactly):**
```ts
interface DayDetailSheetProps {
  visible: boolean;
  date: string;                     // YYYY-MM-DD
  entries: FoodLogEntry[];
  loading?: boolean;
  onClose: () => void;
  onAddFood: () => void;
  onDeleteEntry: (entry: FoodLogEntry) => void;
}
```

**UI structure:**
1. **Title row** — date formatted via `formatDisplayDate(date)` from `src/lib/dateUtils.ts`
2. **Summary row** — tổng kcal + tổng đạm (g) of all entries
3. **Entries list grouped by mealType** — mealType labels from `MEAL_LABELS` constant
   - Each meal section shows meal type as header (e.g., "Bữa sáng")
   - Per-entry row: foodNameVi (left), portion display (right), kcal badge, delete button
   - Portion display: `count + portionUnit` (e.g., "2 viên") if pack/capsule, else `grams + "g"`
4. **Delete confirmation** — tapping ✕ button shows `Alert.alert()` before calling `onDeleteEntry()`
5. **Loading state** — ActivityIndicator spinner when `loading === true`
6. **Empty state** — neutral message "Chưa ghi món nào cho ngày này" when entries list is empty
7. **Add button** — "＋ Thêm món cho ngày này" button at bottom → calls `onAddFood()`

**Built on BottomSheet component:**
- Imports existing `src/components/ui/BottomSheet.tsx` and wraps content inside it
- Used `sheetOffset={600}` for appropriate scroll height
- Did NOT modify BottomSheet.tsx

**Styling:**
- Follows color scheme from `src/lib/theme.ts` (dark bg, amber/purple accents)
- Consistent with existing FoodLogModal + HistoryScreen patterns
- UI labels 100% Vietnamese, code comments English

**Data handling (purity):**
- Zero store/DB imports — all data via props
- Grouping/summary computed via `useMemo` (no impure Date.now()/etc in render body)
- Helper functions (`groupEntriesByMeal`, `formatPortion`, `buildSectionData`) at module level

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ PASS (0 errors) |
| `npx eslint src/components/DayDetailSheet.tsx` | ✅ PASS (0 errors, 0 warnings after removing unused Platform import) |
| TypeScript strict mode | ✅ PASS |
| Props signature matches spec 3d | ✅ YES |

## Handoff

**Component is ready to integrate.** Caller (S-S5) should:
1. Import `DayDetailSheet` from `src/components/DayDetailSheet.tsx`
2. Fetch entries for the selected day via `getFoodLogForDate(date)` 
3. Pass `entries`, `visible`, `date`, `loading` (if async fetch), `onClose`, `onAddFood` (→ open FoodLogModal with date pinned), `onDeleteEntry` (→ call `removeFoodForPastDate(entry)` from store)
4. Place DayDetailSheet in HistoryScreen (or container component triggering it)

**No further work needed for S-S3.** Task complete.
