# S-S2 — PastDateField component (2026-07-10)

## Summary

Created a new component for selecting a past date, following spec section 3d (backfill UI). The component is props-driven (no store/DB imports) and provides:

- Quick-select chips: "Hôm nay" (today), "Hôm qua" (1 day ago), "2 ngày trước" (2 days ago)
- Manual dd/mm input field with validation
- Error display for dates outside allowed range [today − maxDaysBack, today]
- Display label showing formatted date when value ≠ today

## Implementation Details

**File created:**
- `src/components/food/PastDateField.tsx` (220 lines)

**Props interface:**
```ts
interface PastDateFieldProps {
  value: string;                    // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDaysBack: number;              // e.g. DATA_RETENTION_DAYS
}
```

**Key logic:**
- Module-level helper functions: `validateDate()`, `parseDdMmInput()` (ESLint purity)
- dd/mm input parsing with year rollback for future dates (e.g., "01/01" → previous year if result > today)
- Stable memoization: `today` wrapped in `useMemo([])` to satisfy React Compiler dependency tracking
- Color & styling from `src/lib/theme.ts`; date formatting via `formatDisplayDate()` from `src/lib/dateUtils.ts`
- Active chip highlighting with `accentAlt` color and background

**Validation:**
- Rejects dates in the future → error "Không thể chọn ngày tương lai"
- Rejects dates older than maxDaysBack → error "Chỉ có thể ghi lùi tối đa N ngày"
- Only calls `onChange()` if validation passes; on error, shows inline error text but does NOT trigger callback

## Verification

- **TypeScript:** `npx tsc --noEmit` → ✅ exit 0 (clean)
- **ESLint:** `npx eslint src/components/food/PastDateField.tsx` → ✅ 0 errors, 0 warnings
- No imports of store, repository, or DB modules
- Follows ESLint `react-hooks/purity` + `react-hooks/preserve-manual-memoization`
- UI labels in Vietnamese, code comments in English

## Ready for

- **S-S3** (DayDetailSheet) — will accept a date string and render list of entries
- **S-S5** (FoodLogModal integration) — will embed PastDateField alongside time picker to allow backfill selection
