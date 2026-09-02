# 08 — UML tổng quan dự án (từ đầu đến Session 23)

Tài liệu này vẽ lại kiến trúc **BodyBatteries** bằng UML (Mermaid), dựa trên
mã nguồn thực tế tại thời điểm viết (2026-09-02, nhánh `ui-upgrade`, sau
commit `3787546`). Xem thêm giải thích bằng lời tại `docs/03-architecture.md`.

> Cách xem: mở file này trong VS Code có extension Mermaid, trong GitHub
> (render sẵn), hoặc dán từng khối ```mermaid``` vào https://mermaid.live.

---

## 1. Kiến trúc phân lớp (Component / Package Diagram)

Quy tắc vàng: **lớp trên chỉ gọi xuống lớp dưới, không bao giờ ngược lại.**
UI không tự lưu dữ liệu — luôn đi qua Domain → Data.

```mermaid
flowchart TB
    subgraph UI["UI Layer — screens/ + components/"]
        Screens["screens/\nHomeScreen · HistoryScreen · DiaryScreen\nSettingsScreen · OnboardingScreen"]
        Components["components/\nMasterBattery · BatteryCell/Stack\nMicroBatteryStack · TrendChart\nFoodLogModal · IntakeModal\nPowerliftingSheet · BodybuildingSheet ..."]
    end

    subgraph State["State Layer — store/ (Zustand)"]
        EnergyStore["energyStore\n(readings, foodLog, activityLog, intakeLog)"]
        SettingsStore["settingsStore (persist→AsyncStorage)\n(mode, userProfile, language, theme...)"]
        ChargeFx["chargeEffectStore\n(UI hiệu ứng nạp pin)"]
    end

    subgraph Domain["Domain Layer — domain/ (bộ não, pure functions)"]
        BatteryEngine["battery/batteryEngine\nnạp/xả/% pin"]
        EnergyDomain["energy/\nmetabolismEngine (BMR/TDEE)\nenergyBalanceEngine (sổ calo)\nsatietyEngine (pin no/đói)\nliftingEngine · bodybuildingEngine\nweightGoal · profileValidation"]
        FoodDomain["food/\nfoodNutrition · foodLogSummary\ncustomFoodInput · foodSuggestions\nbackfillEngine · portionUnits"]
        NutritionDomain["nutrition/\nmicroBatteryEngine\ndailyNutritionSummary\nnutritionAssessment · overdoseWarning"]
        ModesDomain["modes/modeDefinitions\nTraining · Maintain · Rest"]
        RulesDomain["rules/\nlowBatteryRules · dailyRecommendations"]
    end

    subgraph Data["Data Layer — data/"]
        Repos["repositories/\nbatteryRepository · foodLogRepository\nactivityLogRepository · intakeRepository\ncustomFoodsRepository · foodOverridesRepository\nhealthSignalsRepository · dailyLogRepository"]
        DB["db/database.ts (Expo SQLite)\ndb/schema.ts (CREATE TABLE + migrations)"]
        FoodCatalog["food/\nfoodDatabase.generated.ts (CSV Việt)\nusdaFoods.generated.ts (USDA)\nfoodLookup · foodSearch\ncustomFoodRegistry · foodOverrideRegistry"]
    end

    subgraph Services["Services Layer — services/"]
        Notif["notifications/notificationService"]
        BgReset["background/dailyResetCheck"]
        Export["export/excelExportService\nmonthlyAutoExport"]
        Health["health/appleHealthSync"]
        Cleanup["cleanup/cleanupService"]
        Share["share/dayFoodShareService"]
        Translate["translation/foodNameTranslationService"]
    end

    subgraph I18n["i18n/ — 3 ngôn ngữ (vi/en/de)"]
        UseT["useT() / getCurrentLanguage()"]
        Locales["locales/vi.ts (gốc) · en.ts · de.ts"]
    end

    Screens --> Components
    Components -->|useEnergyStore/useSettingsStore| State
    State -->|gọi hàm thuần| Domain
    State -->|đọc/ghi| Repos
    Domain -.->|không phụ thuộc State/UI| Domain
    Repos --> DB
    Repos --> FoodCatalog
    Services --> Repos
    Services --> Domain
    Components --> UseT
    Domain -->|nhận language param| Locales
    UseT --> Locales
    BgReset --> EnergyStore
```

---

## 2. Class Diagram — Domain Types (`src/types/`)

Đây là các kiểu dữ liệu lõi mà toàn bộ Domain/State/UI thao tác trên đó.

```mermaid
classDiagram
    class BatteryType {
        +BatteryId id
        +string name
        +string unit
        +number defaultCapacity
        +string color
        +string icon
        +boolean isActive
    }

    class BatteryReading {
        +string date
        +BatteryId batteryTypeId
        +number level
        +number capacity
        +number? activityBonusKcal
        +number? satietyReserveKcal
        +number? lastSatietySyncAt
    }

    class DailyLog {
        +string date
        +ModeId modeId
    }

    class IntakeEvent {
        +string id
        +number timestamp
        +BatteryId batteryTypeId
        +number amount
        +string note
    }

    class ModeDefinition {
        +ModeId id
        +string name
        +string description
        +string color
        +Record capacityMultipliers
        +number drainRatePerHour
    }

    class UserProfile {
        +number weightKg
        +number heightCm
        +number age
        +Sex sex
        +OccupationLevel occupation
        +number? averageDailySteps
        +number? goalWeightKg
        +number? goalWeeks
    }

    class WorkoutSession {
        +ActivityType type
        +number minutes
        +number? startAt
        +number? endAt
        +LiftingSet[]? sets
        +string? customName
        +number? customMet
        +string? bbExerciseId
        +MuscleGroup? bbMuscle
        +BbMetTier? bbTier
        +number? bbMet
        +string? bbName
    }

    class LiftingSet {
        +"warmup"|"working" kind
        +number weightKg
        +number reps
    }

    class ActivityLogEntry {
        +string id
        +number timestamp
        +number? startAt
        +number? endAt
        +number steps
        +WorkoutSession[] workouts
        +number energyKcal
        +number satietyDrainKcal
        +string energyDayApplied
        +number? movementStepsApplied
    }

    class FoodItem {
        +string id
        +string nameVi
        +string nameEn
        +string? nameDe
        +string category
        +number defaultServingG
        +ServingPreset[] servingPresets
        +Nutrition per100g
        +string source
        +string note
        +PortionUnit? portionUnit
        +number? servingWeightG
        +string? servingLabel
        +MeasureUnit? measureUnit
    }

    class Nutrition {
        +number energyKcal
        +number waterG
        +number proteinG
        +number fatG
        +number carbG
        +number fiberG
        +number sugarG
        +number calciumMg
        +number ironMg
        +number sodiumMg
        +number potassiumMg
        +number magnesiumMg
        +number zincMg
        +number? epaMg
        +number? dhaMg
    }

    class FoodLogEntry {
        +string id
        +number timestamp
        +MealType mealType
        +string foodId
        +string foodNameVi
        +number grams
        +number energyKcal
        +number proteinG
        +number fatG
        +number carbG
        +number waterG
        +number mineralsMg
        +PortionUnit? portionUnit
        +number? count
        +string? energyDayApplied
    }

    class ServingPreset {
        +string label
        +number grams
    }

    ActivityLogEntry "1" o-- "many" WorkoutSession
    WorkoutSession "1" o-- "many" LiftingSet
    FoodItem "1" o-- "1" Nutrition
    FoodItem "1" o-- "many" ServingPreset
    FoodLogEntry ..> FoodItem : foodId (lookup)
    BatteryReading ..> BatteryType : batteryTypeId
    DailyLog ..> ModeDefinition : modeId
```

---

## 3. Class Diagram — State Layer (Zustand stores)

```mermaid
classDiagram
    class EnergyState {
        +BatteryReading[] readings
        +number masterPercentage
        +FoodLogEntry[] foodLog
        +ActivityLogEntry[] activityLog
        +IntakeEvent[] intakeLog
        +number lastDrainSyncAt
        +boolean isLoaded
        +number appleHealthBurnedKcal
        +AppleHealthStatus appleHealthStatus
        --
        +loadToday(modeId) Promise
        +addIntake(batteryId, amount, note?, opts?) Promise
        +addCalories(kcal, note?) Promise
        +logFood(item, grams, timestamp, portion?) Promise
        +removeFood(id) Promise
        +updateFood(id, patch) Promise
        +logFoodForPastDate(item, grams, timestamp, portion?) Promise
        +removeFoodForPastDate(entry) Promise
        +removeIntake(id) Promise
        +logActivity(activity, timestampOverride?) Promise
        +removeActivity(id) Promise
        +updateActivity(id, patch) Promise
        +logActivityForPastDate(activity, timestamp) Promise
        +removeActivityForPastDate(entry) Promise
        +tickDrain(elapsedHours, modeId) Promise
        +resetForNewDay(modeId) Promise
        +syncAppleHealthBurned() Promise
    }

    class SettingsState {
        +ModeId currentMode
        +number lowBatteryThreshold
        +boolean notificationsEnabled
        +number reminderHour
        +number reminderMinute
        +UserProfile userProfile
        +boolean hasOnboarded
        +MealWindows mealWindows
        +boolean particleEffectsEnabled
        +WaterDisplayUnit waterDisplayUnit
        +MovementDisplayUnit movementDisplayUnit
        +boolean microCollapsed
        +CustomActivity[] customActivities
        +CustomExercise[] customExercises
        +Language language
        +boolean autoTranslateCustomFoodNames
        +ThemeMode themeMode
        --
        +setMode(mode) void
        +setUserProfile(profile) void
        +setMealWindow(meal, window) void
        +addCustomActivity(activity) void
        +addCustomExercise(exercise) void
        +setLanguage(language) void
        +setThemeMode(mode) void
    }

    class ChargeEffectStore {
        +trigger(batteryId) void
    }

    note for SettingsState "Còn nhiều setter đơn giản khác (setLowBatteryThreshold, setNotificationsEnabled...), không liệt kê hết"
    note for ChargeEffectStore "Hiệu ứng UI khi nạp pin (P4/P7), không liên quan dữ liệu bền vững"

    EnergyState ..> BatteryReading
    EnergyState ..> FoodLogEntry
    EnergyState ..> ActivityLogEntry
    EnergyState ..> IntakeEvent
    SettingsState ..> UserProfile
    SettingsState ..> CustomActivity
    SettingsState ..> CustomExercise
    EnergyState ..> SettingsState : đọc modeId/userProfile khi gọi Domain
```

*Lưu ý:* `SettingsState` được `persist` vào AsyncStorage (`settings-storage`);
`EnergyState` KHÔNG persist trực tiếp — nó là bản sao trong RAM của
`battery_readings`/`food_log`/`activity_log`/`intake_events` trong SQLite,
đồng bộ qua các hàm repository mỗi lần thay đổi.

---

## 4. Class Diagram — Data Layer (Repository + SQLite)

```mermaid
classDiagram
    class batteryRepository {
        +getReadingsForDate(date) Promise
        +upsertReading(reading) Promise
        +upsertReadings(readings) Promise
        +getReadingsInRange(from,to) Promise
        +getLatestEnergyReadingBefore(date) Promise
        +deleteReadingsBefore(date) Promise
    }
    class foodLogRepository {
        +addFoodLogEntry(entry) Promise
        +getFoodLogForDate(date) Promise
        +getFoodLogInRange(from,to) Promise
        +deleteFoodLogEntry(id) Promise
        +deleteFoodLogBefore(date) Promise
    }
    class activityLogRepository {
        +addActivityLogEntry(entry) Promise
        +getActivityLogForDate(date) Promise
        +getActivityLogInRange(from,to) Promise
        +updateActivityLogEntry(entry) Promise
        +deleteActivityLogEntry(id) Promise
    }
    class intakeRepository {
        +addIntakeEvent(event) Promise
        +getIntakeEventsForDate(date) Promise
        +getIntakeEventsInRange(from,to) Promise
        +deleteIntakeEventsBefore(date) Promise
        +deleteIntakeEventsByIds(ids) Promise
    }
    class dailyLogRepository {
        +getDailyLog(date) Promise
        +upsertDailyLog(log) Promise
        +getLogsInRange(from,to) Promise
        +deleteLogsBefore(date) Promise
        +saveDiaryEntry(date, content) Promise
    }
    class customFoodsRepository {
        +addCustomFood(item) Promise
        +getAllCustomFoods() Promise
        +getCustomFoodById(id) Promise
        +deleteCustomFood(id) Promise
    }
    class foodOverridesRepository {
        +upsertOverride(item) Promise
        +getAllOverrides() Promise
        +getOverrideById(id) Promise
        +deleteOverride(id) Promise
    }
    class healthSignalsRepository {
        +logWeight(kg) Promise
        +getWeightHistory(...) Promise
        +updateWeight(id, kg) Promise
        +logAppleHealthBurned(...) Promise
        +getAppleHealthBurnedForDate(date) Promise
        +recordSyncTimestamp(status) Promise
        +getLastSyncTimestamp() Promise
    }

    class SQLiteDatabase {
        <<Expo SQLite>>
        battery_types
        daily_log
        battery_readings
        intake_events
        health_signals
        diary_entries
        food_log
        custom_foods
        food_overrides
        activity_log
    }

    class foodLookup {
        +getAnyFoodById(id) FoodItem
    }
    class customFoodRegistry {
        +search(query) FoodItem[]
    }
    class foodOverrideRegistry {
        +get(foodId) FoodItem
    }

    note for foodLookup "Merge: generated catalog + custom_foods + food_overrides"
    note for customFoodRegistry "Index runtime cho custom_foods (search không cần reload app)"
    note for foodOverrideRegistry "Index runtime cho food_overrides"

    batteryRepository --> SQLiteDatabase : battery_readings
    foodLogRepository --> SQLiteDatabase : food_log
    activityLogRepository --> SQLiteDatabase : activity_log
    intakeRepository --> SQLiteDatabase : intake_events
    dailyLogRepository --> SQLiteDatabase : daily_log, diary_entries
    customFoodsRepository --> SQLiteDatabase : custom_foods
    foodOverridesRepository --> SQLiteDatabase : food_overrides
    healthSignalsRepository --> SQLiteDatabase : health_signals

    foodLookup --> customFoodRegistry
    foodLookup --> foodOverrideRegistry
    customFoodRegistry --> customFoodsRepository
    foodOverrideRegistry --> foodOverridesRepository
```

---

## 5. Sequence Diagram — Ghi nhận một bữa ăn ("logFood")

Luồng chính khi người dùng log một món ăn từ `FoodLogModal`.

```mermaid
sequenceDiagram
    actor User
    participant UI as FoodLogModal (UI)
    participant Store as energyStore.logFood()
    participant NutriDom as domain/food/foodNutrition
    participant BalDom as domain/energy/energyBalanceEngine
    participant SatDom as domain/energy/satietyEngine
    participant Repo as foodLogRepository / batteryRepository
    participant DB as SQLite

    User->>UI: chọn món ăn + số gram + thời gian
    UI->>Store: logFood(item, grams, timestamp, portion?)
    Store->>NutriDom: nutritionForGrams(item.per100g, grams)
    NutriDom-->>Store: Nutrition đã quy đổi
    Store->>BalDom: chargeEnergy(reading, kcal)
    BalDom-->>Store: BatteryReading mới (energy)
    Store->>SatDom: eatIntoReserve(reserveKcal, kcalEaten)
    SatDom-->>Store: satietyReserveKcal mới
    Store->>Store: applyIntake() cho protein/carbs/water/minerals
    Store->>Repo: addFoodLogEntry(entry)
    Repo->>DB: INSERT INTO food_log
    Store->>Repo: upsertReadings(readings[])
    Repo->>DB: INSERT/UPDATE battery_readings
    Store-->>UI: cập nhật state (foodLog, readings)
    UI-->>User: Pin năng lượng + vi chất cập nhật tức thì
```

---

## 6. Sequence Diagram — Xả pin theo thời gian & Reset ngày mới

```mermaid
sequenceDiagram
    participant Hook as useDrainTick (UI hook)
    participant Store as energyStore
    participant Battery as domain/battery/batteryEngine
    participant Meta as domain/energy/metabolismEngine
    participant Repo as batteryRepository
    participant BgCheck as services/background/dailyResetCheck

    loop mỗi vài giây khi app mở
        Hook->>Store: tickDrain(elapsedHours, modeId)
        Store->>Battery: applyDrain(reading, mode, elapsedHours)
        Battery-->>Store: reading đã xả
        Store->>Repo: upsertReadings(readings)
    end

    Note over BgCheck: App mở lại sau nửa đêm (6h sáng = "energy day" mới)
    BgCheck->>Store: phát hiện sang ngày mới
    Store->>Meta: dailyExpenditure(profile) → capacity mới
    Store->>Battery: createDailyReading() cho từng battery
    Store->>Repo: upsertReadings(readings mới) + upsertDailyLog(modeId)
    Store-->>Hook: readings reset về đầu ngày
```

---

## 7. State Diagram — Mode & vòng đời "energy day"

```mermaid
stateDiagram-v2
    [*] --> Maintain
    Maintain --> Training: người dùng chọn "Training"
    Maintain --> Rest: người dùng chọn "Rest"
    Training --> Maintain
    Rest --> Maintain
    Training --> Rest
    Rest --> Training

    state "Mỗi Mode override" as ModeEffect {
        [*] --> ApplyCapacityMultipliers
        ApplyCapacityMultipliers --> ApplyDrainRatePerHour
        ApplyDrainRatePerHour --> [*]
    }

    Maintain --> ModeEffect
    Training --> ModeEffect
    Rest --> ModeEffect
```

```mermaid
stateDiagram-v2
    [*] --> DangHoatDong: 06:00 hôm nay
    DangHoatDong --> DangHoatDong: tickDrain / logFood / logActivity / addIntake
    DangHoatDong --> DaKhoa: đến 06:00 hôm sau (energy day mới)
    DaKhoa --> [*]: dữ liệu chuyển vào History (chỉ đọc)
```

---

## 8. Component Diagram — Cây UI chính (Home screen)

```mermaid
flowchart TD
    Home[HomeScreen]
    Home --> MasterBattery
    Home --> ModeSelector
    Home --> MicroBatteryStack --> MicroBatterySourceSheet
    Home --> BatteryStack --> BatteryCell --> BatterySourceSheet
    Home --> EnergyActionsBar
    EnergyActionsBar --> IntakeModal
    EnergyActionsBar --> FoodLogModal --> CustomFoodFields
    EnergyActionsBar --> PowerliftingSheet
    EnergyActionsBar --> BodybuildingSheet
    EnergyActionsBar --> SupplementQuickLog
    Home --> TodayMeals --> FoodNutritionEditModal
    Home --> TodayActivities
    Home --> TodayIntakes
    Home --> DayDetailSheet
    FoodLogModal --> NutritionDetailSheet
    FoodLogModal --> MyFoodsSheet
    Home --> WeightLogCard
    Home --> EnergyBalanceCard
    Home --> BodyProfileCard --> BodyRecommendationsSheet
    Home --> AppleHealthStatusBadge
    Home --> OverdoseNotice
```

---

## 9. Ghi chú lịch sử (mốc kiến trúc quan trọng)

| Mốc | Thay đổi kiến trúc chính |
|---|---|
| Phase 1 (MVP) | `batteryEngine` thuần (nạp/xả/%), `battery_readings` + `daily_log` SQLite |
| Phase 2 (Modes) | `modeDefinitions` + `lowBatteryRules`, `dailyResetCheck` nền |
| Phase 3 (Excel/Diary/Cleanup) | `excelExportService`, `diary_entries` (mã hoá), `cleanupService` (xoá >1 tuần) |
| S-M (Hướng B) | Đổi "energy battery" từ tổng calo cố định sang mô hình cân bằng calo (`energyBalanceEngine`), `activityBonusKcal` |
| S-Q (Satiety) | Thêm pin "no/đói" liên tục (`satietyEngine`, `satietyReserveKcal`, `lastSatietySyncAt`) |
| S-N/U7 (Food data) | Pipeline sinh `usdaFoods.generated.ts`, `searchAllFoods` gộp song ngữ, `getAnyFoodById` là điểm tra cứu bắt buộc |
| S-PL (Powerlifting) | `liftingEngine` (tấn số × ROM từ chiều cao), `LiftingSet`, set-based squat/bench/deadlift |
| S-BB (Bodybuilding) | `bodybuildingEngine` (MET-tier theo nhóm cơ), 45 bài/8 nhóm cơ, tách biệt khỏi S-PL |
| B2 | `ActivityLogEntry` độc lập (sửa/xoá được), thay cho ghi `intake_events` một chiều |
| FIX #1/#5 | `energyDayApplied` trên `FoodLogEntry`/`ActivityLogEntry` — tách "ngày lịch" khỏi "ngày năng lượng" (reset 6h sáng) |
| Session 14 (i18n) | `src/i18n/` tự viết tay (không dùng i18next), 3 ngôn ngữ vi/en/de |
| Session 20-23 | Fix hiển thị tổng pin phụ, tên món ăn theo ngôn ngữ + auto-translate, nút "Dùng làm mẫu" powerlifting |

---

*File này là ảnh chụp kiến trúc tại một thời điểm — khi thêm bảng DB, store,
hoặc domain engine mới, hãy cập nhật lại các class/sequence diagram tương ứng
ở trên (không cần tạo file UML mới cho mỗi lần đổi).*
