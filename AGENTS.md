# MANDATORY RULE: UI text & multi-language (i18n)

The app ships in **Vietnamese / English / German** via a deliberately
hand-rolled system in `src/i18n/` (Session 14). This is an architectural
decision, not a gap: there is NO i18next / react-i18next / expo-localization,
and none may be added. The existing Zustand `settingsStore.language` field
(already persisted to the device through the `persist` middleware +
AsyncStorage) plus plain nested TypeScript dictionaries do the whole job with
zero new dependencies, and `useT()` subscribes to only that one store field —
so switching language re-renders only the components that call it, never the
whole tree (the app has no React Context by convention). Rationale:
`docs/02-tech-stack.md` § "Vì sao không chọn i18next"; mechanics:
`docs/03-architecture.md` § "🌐 Đa ngôn ngữ".

Whenever you add a feature, create a UI component, or touch ANY user-facing
text, you MUST work WITH this system — never around it:

1. **NO HARDCODED STRINGS.** No user-visible literal text in
   `screens/`/`components/` — this includes `Alert.alert`, `placeholder`,
   `accessibilityLabel`, notification bodies, share-dialog titles, and Excel
   sheet names / column headers. Non-UI literals (log messages, error codes,
   DB seed values) are exempt.
2. **UPDATE ALL THREE DICTIONARIES.** Add new keys to
   `src/i18n/locales/vi.ts` FIRST (it is the structural source of truth),
   then mirror them in `en.ts` and `de.ts`. Both are typed
   `TranslationSchema = typeof vi`, so `npx tsc --noEmit` fails if any locale
   is missing a key — never silence that with `as const`, `any`, or partial
   types.
3. **APPLY TRANSLATIONS THE LAYERED WAY** (see `docs/03-architecture.md`):
   - Components/screens: `const { t, language } = useT();` → `t('a.b.c')`.
   - Domain/services pure functions: take an explicit `language: Language`
     parameter — NEVER read the store from domain code.
   - Non-React entry points (background tasks, auto-export):
     `getCurrentLanguage()` from `src/i18n`.
   - Dates/numbers: `LOCALE_TAGS[language]` — never hardcode `'vi-VN'` etc.
   - Battery/meal/category/mode/activity names: use the lookup helpers
     (`batteryTypeName`, `mealLabel`, `foodCategoryLabel`, `modeName`,
     `activityLabel`) — never display `battery_types.name` from SQLite.
   - Logged food names: use `foodDisplayName`/`foodLogEntryDisplayName`
     (`src/data/food/foodLookup.ts`) — they resolve the live `FoodItem` via
     `foodId` so a catalog-backed entry follows a later language switch
     (the catalog already carries `nameVi`/`nameEn`/`nameDe`). The frozen
     `FoodLogEntry.foodNameVi` snapshot is ONLY the fallback for entries the
     catalog can no longer resolve — a custom (user-typed) food, which has
     just one name in any language, or a catalog id since deleted/replaced.
     Never widen this exception back to catalog-backed entries.
4. **DELEGATION CONTRACT.** Any subagent prompt that touches UI must include
   this rule (hook name, locale-file flow, "no hardcoded strings").
5. **DOCUMENTATION (auto, no permission needed).** Once the feature works and
   `npm run verify` passes, update the relevant `docs/*.md` and the session
   log per `.ai/skills/session-wrapup.md`, noting that the feature is
   i18n-covered.

Adding a NEW language later: follow `.ai/skills/add-language.md` (≈4 small
steps, no library needed).

# Expo SDK version

This project is pinned to **Expo SDK 54** (see `package.json`: `expo` ^54,
`react-native` 0.81.5, `react` 19.1.0). It matches the Expo Go build installed
on the test phone.

- Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/
  before writing any code.
- Do NOT upgrade the SDK (or jump to 55/56) without a clear reason and the
  user's approval — an upgrade can break the working environment and must be
  re-matched against the Expo Go version on the phone.
- Note: in SDK 54 the classic `expo-file-system` API lives at
  `expo-file-system/legacy`; the main entry is the new File/Directory API.
