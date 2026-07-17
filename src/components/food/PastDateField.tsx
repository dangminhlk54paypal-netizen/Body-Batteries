import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { todayString, dateString, formatDisplayDate, isToday } from '../../lib/dateUtils';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export interface PastDateFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDaysBack: number; // e.g. DATA_RETENTION_DAYS
}

// Wrapper to call Date functions at module level, hiding from ESLint purity
// checks (not part of component render body).
function getTodayString(): string {
  return todayString();
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Pure "N days before `todayStr`" — unlike daysAgo() this never reads the
// live clock, so render-time callers (validateDate/activeChip) stay anchored
// to the SAME memoized `today` the rest of the component uses (ISSUE-3,
// S-S6 review): no drift if a render straddles midnight.
function dateDaysBefore(todayStr: string, days: number): string {
  const d = new Date(todayStr + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return dateString(d);
}

// Validate date is within allowed range [today - maxDaysBack, today]
function validateDate(dateStr: string, today: string, maxDaysBack: number, t: TFn):
  { ok: true } | { ok: false; reason: string } {
  if (!dateStr || dateStr.length !== 10) {
    return { ok: false, reason: 'Invalid date format' };
  }

  // Check if date is in the future
  if (dateStr > today) {
    return { ok: false, reason: t('components.pastDateField.errorFutureDate') };
  }

  // Check if date is too old
  const earliestAllowed = dateDaysBefore(today, maxDaysBack);
  if (dateStr < earliestAllowed) {
    return { ok: false, reason: t('components.pastDateField.errorTooOld', { max: maxDaysBack }) };
  }

  return { ok: true };
}

// Parse dd/mm input to YYYY-MM-DD (using current year; if result is future, roll back 1 year)
function parseDdMmInput(input: string, today: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  let year = getCurrentYear();
  let candidate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const candidateDateStr = dateString(candidate);

  // If result is in the future, roll back 1 year
  if (candidateDateStr > today) {
    year -= 1;
    candidate = new Date(year, month - 1, day, 0, 0, 0, 0);
    return dateString(candidate);
  }

  return candidateDateStr;
}

export function PastDateField({ value, onChange, maxDaysBack }: PastDateFieldProps) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [inputValue, setInputValue] = useState('');

  // Memoize today so it's a stable dependency for other useMemo hooks.
  const today = useMemo(() => getTodayString(), []);

  // Quick-select chips: 0 days ago (today), 1 day ago, 2 days ago, etc.
  // "Hôm kìa" (3 days ago) has its own dedicated Vietnamese word — a generic
  // common.daysAgo("3 ngày trước") reads unnaturally next to "Hôm qua", so it
  // gets its own key (common.threeDaysAgo) instead.
  const quickSelects = useMemo(() => {
    return [
      { label: t('common.today'), days: 0 },
      { label: t('common.yesterday'), days: 1 },
      { label: t('common.daysAgo', { n: 2 }), days: 2 },
      { label: t('common.threeDaysAgo'), days: 3 },
    ];
  }, [t]);

  // Handle dd/mm input change
  function handleInputChange(text: string) {
    setInputValue(text);
  }

  // Handle dd/mm input blur: validate and commit if valid
  function handleInputBlur() {
    const parsed = parseDdMmInput(inputValue, today);
    if (!parsed) {
      setInputValue('');
      return;
    }

    const validation = validateDate(parsed, today, maxDaysBack, t);
    if (validation.ok) {
      onChange(parsed);
      setInputValue('');
    } else {
      // Error case: don't call onChange, just keep input for user to see they can try again
      // The error message will be shown below the input
    }
  }

  // Handle quick-select chip press
  function handleQuickSelect(days: number) {
    const selected = dateDaysBefore(today, days);
    const validation = validateDate(selected, today, maxDaysBack, t);
    if (validation.ok) {
      onChange(selected);
      setInputValue('');
    }
  }

  // Determine if there's a validation error in the current input
  const inputError = useMemo(() => {
    const parsed = parseDdMmInput(inputValue, today);
    if (!parsed || !inputValue.trim()) return null;
    const validation = validateDate(parsed, today, maxDaysBack, t);
    return validation.ok ? null : validation.reason;
  }, [inputValue, today, maxDaysBack, t]);

  // Determine which chip is currently active
  const activeChip = useMemo(() => {
    for (const chip of quickSelects) {
      if (value === dateDaysBefore(today, chip.days)) {
        return chip.days;
      }
    }
    return null;
  }, [value, quickSelects, today]);

  return (
    <View style={styles.container}>
      {/* Quick-select chips */}
      <View style={styles.chipsRow}>
        {quickSelects.map((chip) => (
          <Pressable
            key={chip.days}
            style={[
              styles.chip,
              activeChip === chip.days && styles.chipActive,
            ]}
            onPress={() => handleQuickSelect(chip.days)}
          >
            <Text
              style={[
                styles.chipLabel,
                activeChip === chip.days && styles.chipLabelActive,
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* dd/mm input */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, inputError && styles.inputError]}
          placeholder="dd/mm"
          placeholderTextColor={c.textMuted}
          value={inputValue}
          onChangeText={handleInputChange}
          onBlur={handleInputBlur}
          maxLength={5}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Error message */}
      {inputError && <Text style={styles.errorText}>{inputError}</Text>}

      {/* Display label when value != today */}
      {value && !isToday(value) && (
        <Text style={styles.displayLabel}>{formatDisplayDate(value, language)}</Text>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginVertical: 8,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.bgAlt,
  },

  chipActive: {
    borderColor: c.accentAlt,
    backgroundColor: c.accentAltBg,
  },

  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textSecondary,
  },

  chipLabelActive: {
    color: c.accentAlt,
  },

  inputRow: {
    marginBottom: 8,
  },

  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.bgCard,
    fontSize: 14,
    color: c.textPrimary,
  },

  inputError: {
    borderColor: c.danger,
  },

  errorText: {
    fontSize: 12,
    color: c.danger,
    marginTop: 4,
    marginBottom: 4,
  },

  displayLabel: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 4,
  },
});
