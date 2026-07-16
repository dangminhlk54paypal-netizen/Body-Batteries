import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

// Pure "time ago" formatter for small sync-status captions (Apple Health
// badge on Home, "Last synced" line in Settings). No I/O, no Date.now()
// default baked in as a side effect — callers pass `nowMs` explicitly so
// this stays deterministic and easy to unit-test.

export function formatRelativeTime(ts: number, nowMs: number, language: Language): string {
  const diffMs = Math.max(0, nowMs - ts);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return translate(language, 'common.justNow');
  if (minutes < 60) return translate(language, 'common.minutesAgo', { n: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(language, 'common.hoursAgo', { n: hours });

  const days = Math.floor(hours / 24);
  return translate(language, 'common.daysAgo', { n: days });
}
