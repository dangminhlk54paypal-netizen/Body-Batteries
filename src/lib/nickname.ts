// The name the app calls the user by (Settings → Hồ sơ cơ thể). Printed in
// every Excel export and meant for future greetings/reminders — never sent
// anywhere: it lives only in the persisted settings store like everything else.
export const NICKNAME_MAX_LENGTH = 24;

// Trim, collapse inner whitespace and cap the length. '' = no nickname set.
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NICKNAME_MAX_LENGTH).trim();
}
