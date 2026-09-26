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

# MANDATORY RULE: compact UI (no information overload)

The owner reads this app on a phone; a wall of text overwhelms. Before creating
or changing anything the user sees, follow `.ai/skills/mobile-ui-density.md`:
long content scrolls inside a small fixed-height window; layered content folds
level by level (Month › Week › Day, one card open at a time, the current item
open, the user's own open/fold choice never overridden by automation);
secondary text hides behind a symbol that fits its job (ⓘ explain, ✎ edit,
＋ add); repeated equivalent labels are abbreviated (Mon/Tue…, B3W4) with
horizontal swipe between them; rows and buttons are balanced and symmetric.
Any subagent prompt that touches UI must include this rule next to the i18n
rule.

After every session, whatever the owner approved or refined becomes a skill
for next time (`.ai/skills/session-wrapup.md` step 5b) — new UI patterns go
into `mobile-ui-density.md`, hard bugs into `.ai/skills/learned/`.

# MANDATORY RULE: research with cited sources

Whenever the owner asks to research, investigate, compare, or plan something
that depends on outside information (store policies, prices, limits, library
behaviour, security, law), follow `.ai/skills/research-report.md`: verify
every external fact by opening the primary source (never from memory), mark
it inline where it is used (`[n]` web source, `[Mã: file]` code evidence,
💡 own opinion, ❓ unverified), list the full URLs with access date at the
end, and add an "Đính chính" section when a source contradicts something said
earlier. Reports are saved in `docs/nghien-cuu/` and indexed in its README.
This applies to research answers given only in chat, too.

# Expo SDK version

This project is pinned to **Expo SDK 57** (see `package.json`: `expo` ^57,
`react-native` 0.86.3, `react` 19.2.3). It matches the Expo Go build installed
on the test phone. (Upgraded 2026-09-09 from SDK 54 — Expo Go on the phone had
auto-updated to require SDK 57 and Apple does not allow installing older Expo
Go builds, so staying on Expo Go left no choice but to move the project.)

- Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/
  before writing any code.
- Do NOT upgrade the SDK further without a clear reason and the user's
  approval — an upgrade can break the working environment and must be
  re-matched against the Expo Go version on the phone.
- New Architecture is mandatory from SDK 55 onward (no `newArchEnabled` /
  legacy architecture escape hatch anymore).
- `expo-file-system/legacy` was removed in this jump. All file I/O now uses
  the `File`/`Directory`/`Paths` API from `expo-file-system` (see
  `src/services/food/myFoodsBackupService.ts`,
  `src/services/export/excelExportService.ts`,
  `src/services/export/trainingBlockExportService.ts` for the pattern:
  `new File(Paths.document, name)`, `file.create({ overwrite: true })`,
  `file.write(...)`, `file.text()`).
- Splash screen config moved from the top-level `app.json` `"splash"` key to
  the `expo-splash-screen` config plugin (see `app.json` `plugins`).
- `react-native-health` is flagged by `expo-doctor` as untested on the New
  Architecture (mandatory since SDK 55). It already runtime-detects and
  no-ops when its native module isn't linked (see the guard in
  `appleHealthSync.ts`), which is why it hasn't blocked plain Expo Go usage —
  but this is the thing to verify first if/when a development-client build
  (`expo-dev-client`, already installed) is made to test real HealthKit sync
  on-device.

# Testing on the phone: EAS Update (TEMPORARY — solo-developer phase)

While the project has a single developer (since 2026-09-24), every change
that affects what runs on the device ends with a cloud publish so the owner
can try it on their iPhone via Expo Go — no Mac dev server needed:

1. Finish the change and get `npm run verify` fully green.
2. Run `.ai/skills/eas-preview-publish.md`: publish to the **`preview`**
   branch (`npx eas-cli update --branch preview --environment preview
   --non-interactive --message "…"`) and send the owner the
   `https://u.expo.dev/update/<group-id>` link plus a concrete test checklist.
   This is pre-approved for `preview` only — ask before any other branch.
3. Skip it for docs/test-only changes; for new native modules say a dev-client
   build is needed instead. If the working tree mixes in another session's
   unfinished work, publish from an isolated copy (see the skill) — never
   `git stash`/`reset` the shared tree.

This rule is temporary: once a second person joins the team, stop
auto-publishing and follow "Khi team có thêm người" in the skill.
