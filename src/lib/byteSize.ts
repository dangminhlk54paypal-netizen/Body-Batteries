import { LOCALE_TAGS, type Language } from '../i18n/types';

// "820 KB" / "1,5 MB" in the app language's number style.
export function formatBytes(bytes: number, language: Language): string {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${new Intl.NumberFormat(LOCALE_TAGS[language], { maximumFractionDigits: 0 }).format(Math.max(1, kb))} KB`;
  }
  return `${new Intl.NumberFormat(LOCALE_TAGS[language], { maximumFractionDigits: 1 }).format(kb / 1024)} MB`;
}
