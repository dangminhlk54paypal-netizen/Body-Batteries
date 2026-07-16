# 03 — Cấu trúc hệ thống & Mô hình dữ liệu

## 🏗️ Kiến trúc theo lớp (Layered Architecture)

App được chia thành các lớp rõ ràng để bạn và AI luôn biết "code này nằm ở đâu":

```
┌─────────────────────────────────────────────┐
│  UI Layer (Màn hình & thành phần giao diện)   │  ← Pin, biểu đồ, nút bấm
│  screens/  components/                        │
├─────────────────────────────────────────────┤
│  State Layer (Trạng thái app)                 │  ← Zustand stores
│  store/                                       │
├─────────────────────────────────────────────┤
│  Domain Layer (Logic năng lượng - "bộ não")   │  ← Tính nạp/xả, reset, Mode
│  domain/  (battery engine, modes, rules)      │
├─────────────────────────────────────────────┤
│  Data Layer (Lưu trữ)                         │  ← SQLite, SecureStore
│  data/  (repositories, db)                    │
├─────────────────────────────────────────────┤
│  Services Layer (Dịch vụ nền & ngoài)         │  ← Thông báo, Excel, Health
│  services/  (notifications, export, health)   │
└─────────────────────────────────────────────┘
```

**Quy tắc vàng:** lớp trên chỉ gọi xuống lớp dưới, không bao giờ ngược lại. Giao diện (UI) không tự lưu dữ liệu — phải đi qua Domain → Data.

---

## 📁 Cấu trúc thư mục mã nguồn (cập nhật 2026-07-03 theo code thực tế)

```
src/
├── screens/            # Các màn hình (Home, History, Settings, Diary, Onboarding)
├── components/         # Khối tái sử dụng (BatteryCell, MasterBattery, TrendChart...)
├── navigation/         # Điều hướng tab (React Navigation)
├── hooks/              # Hook React (useDrainTick, useLiveEnergyReading, useLowEnergyWatch)
├── store/              # Zustand: energyStore, settingsStore
├── types/              # Kiểu TypeScript dùng chung (battery, energy...)
├── domain/
│   ├── battery/        # "Battery engine": tính mức pin, nạp, xả
│   ├── energy/         # metabolismEngine (BMR/TDEE), energyBalanceEngine (sổ calo), satietyEngine (pin no/đói), weightGoal (mục tiêu kcal), profileValidation
│   ├── food/           # foodNutrition, foodLogSummary (quy đổi món ăn → dinh dưỡng)
│   ├── modes/          # Định nghĩa các Mode và ảnh hưởng
│   └── rules/          # Quy tắc nhắc nhở/cảnh báo
├── data/
│   ├── db/             # Khởi tạo SQLite, schema
│   ├── food/           # Danh sách món ăn (CSV Việt + USDA generated) + loader
│   └── repositories/   # Đọc/ghi dữ liệu (batteryRepo, intakeRepo, healthSignalsRepo...)
├── services/
│   ├── notifications/  # Nhắc nhở, cảnh báo
│   ├── background/     # Kiểm tra sang ngày mới (dailyResetCheck)
│   ├── export/         # Xuất Excel
│   └── cleanup/        # Tự xoá dữ liệu > 1 tuần
├── i18n/               # Đa ngôn ngữ (Việt/Anh/Đức) — xem mục riêng bên dưới
└── lib/                # Tiện ích chung (ngày tháng, mã hoá, metabolicConstants)
```

**Ngoài `src/` (gốc repo):**
- `scripts/` — script Node sinh dữ liệu món ăn (`gen:food`, `gen:usda`), chạy trước khi start.
- `database/` — dữ liệu USDA: `raw/` (file gốc 6.4MB, KHÔNG commit) + `extract/` (CSV gọn, có commit).
- `.ai/` — luật dự án, skills, agents, báo cáo song song. `.claude/` — cấu hình Claude Code
  (native subagents + hooks lint tự động, xem `.ai/CONTEXT.md` mục 6).
- `services/health/` chưa tồn tại — sẽ tạo khi tích hợp HealthKit/Health Connect (S-F v2).

---

## 🌐 Đa ngôn ngữ (Session 14, 2026-07-17)

Toàn bộ giao diện + file Excel xuất ra hỗ trợ **3 ngôn ngữ: Tiếng Việt (mặc
định) / English / Deutsch**, chọn từ mục "🌐 NGÔN NGỮ" đầu màn Cài đặt.

```
src/i18n/
├── types.ts       # Language ('vi'|'en'|'de'), LOCALE_TAGS (map sang 'vi-VN'/'en-US'/'de-DE')
├── translate.ts   # translate(language, key, vars?) — tra cứu theo đường dẫn "a.b.c" + nội suy {{var}}
├── useT.ts         # useT() hook cho component: { t, language } · useLanguage() · getCurrentLanguage()
├── index.ts        # barrel export
└── locales/
    ├── vi.ts        # nguồn gốc cấu trúc (mọi key phải xuất phát từ đây trước)
    ├── en.ts         # phải khớp CHÍNH XÁC cấu trúc vi.ts — tsc báo lỗi nếu thiếu key
    └── de.ts         # tương tự en.ts
```

**Cách hoạt động:**
- Lựa chọn ngôn ngữ lưu ở `settingsStore.language` — field Zustand bình
  thường, tự động lưu vào máy qua middleware `persist` (AsyncStorage) đã có
  sẵn từ trước, không cần thêm cơ chế lưu trữ mới.
- Component gọi `const { t, language } = useT();` rồi `t('settings.title')`.
  Hook này **chỉ theo dõi đúng field `language`** trong store — đổi ngôn ngữ
  chỉ vẽ lại những component có gọi `useT()`, không vẽ lại toàn app (app này
  vốn không dùng React Context cho theme/state toàn cục, xem `lib/theme.ts`)
  → đổi ngôn ngữ mượt, không giật/khựng.
- Hàm thuần (domain/service, không phải component — vd
  `nutritionAssessment.ts`, `excelExportService.ts`) nhận `language` như một
  tham số bình thường thay vì tự đọc store, giữ đúng nguyên tắc lớp Domain
  "thuần, dễ test" trong sơ đồ kiến trúc ở đầu file này.
- **An toàn kiểu dữ liệu:** `vi.ts` là cấu trúc gốc; `en.ts`/`de.ts` được ép
  kiểu theo đúng cấu trúc đó (`TranslationSchema = typeof vi`), nên `npx tsc
  --noEmit` sẽ báo lỗi ngay nếu ai đó thêm 1 chuỗi vào `vi.ts` mà quên thêm
  bản dịch tương ứng ở `en.ts`/`de.ts` — không thể "quên dịch" mà không bị
  phát hiện khi build.
- **Tên các pin** (Protein/Carbs/Nước...) vốn được lưu 1 lần trong SQLite
  (`battery_types.name`) lúc cài app lần đầu — thay vì đọc cột đó, màn hình
  luôn tra theo `id` pin qua `batteryTypeName(id, language)`
  (`src/lib/constants.ts`) nên tên pin vẫn đổi được theo ngôn ngữ dù dữ liệu
  gốc trong DB không đổi.
- **Cố ý KHÔNG dịch:** tên món ăn đã ghi vào Nhật ký ăn uống
  (`FoodLogEntry.foodNameVi`) — đây là snapshot tiếng Việt tại đúng lúc ghi
  món, đổi ngôn ngữ sau đó không viết lại lịch sử (xem thêm
  `docs/excel-report.md` mục 0).

## 🗃️ Mô hình dữ liệu (Data Model)

Các "bảng" dữ liệu chính lưu trong SQLite. *Tên cột bằng tiếng Anh (theo luật code), mô tả bằng tiếng Việt.*

### `battery_types` — định nghĩa từng loại pin
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã định danh (vd: `protein`) |
| `name` | text | tên hiển thị |
| `unit` | text | đơn vị (g, ml, mg...) |
| `default_capacity` | number | sức chứa mặc định |
| `color` | text | màu hiển thị |
| `icon` | text | tên icon |
| `is_active` | boolean | đang bật hiển thị hay không |

### `daily_log` — mỗi ngày một bản ghi
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text (YYYY-MM-DD) | ngày |
| `mode_id` | text | Mode đang dùng hôm đó |

### `battery_readings` — mức pin theo ngày
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text | ngày |
| `battery_type_id` | text | loại pin |
| `level` | number | mức hiện tại |
| `capacity` | number | sức chứa hôm đó (tuỳ Mode) |

### `intake_events` — sự kiện nạp (ăn/uống)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã |
| `timestamp` | number | thời điểm |
| `battery_type_id` | text | nạp vào pin nào |
| `amount` | number | lượng nạp |
| `note` | text | ghi chú ngắn |

### `health_signals` — tín hiệu ngoài (giai đoạn sau)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `timestamp` | number | thời điểm |
| `source` | text | nguồn (watch, phone...) |
| `type` | text | steps / heart_rate / sleep / stress |
| `value` | number | giá trị |

### `food_log` — món ăn đã ghi trong ngày (Session 5+)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã |
| `timestamp` | number | thời điểm ghi |
| `meal_type` | text | bữa (sáng/trưa/tối/phụ) |
| `food_id` / `food_name_vi` | text | món nào (id trong danh sách món + tên tiếng Việt) |
| `grams` | number | lượng ăn (g) |
| `energy_kcal`, `protein_g`, `fat_g`, `carb_g`, `water_g`, `minerals_mg` | number | dinh dưỡng đã quy đổi theo lượng |

### `diary_entries` — nhật ký riêng tư (mã hoá, write-only)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text | ngày |
| `encrypted_content` | text | nội dung đã mã hoá — **app không tự giải mã để phân tích** |

---

## 🔁 Luồng dữ liệu chính (ví dụ: người dùng ăn 1 bữa)

```
Người dùng bấm "Nạp Protein 30g"
        │
        ▼
UI (màn hình Home) ──► store (energyStore.addIntake)
        │
        ▼
domain/battery (tính lại mức pin) ──► data/repositories (lưu intake_event + cập nhật reading)
        │
        ▼
domain/rules (kiểm tra: pin có sắp cạn không?)
        │
        ▼
services/notifications (nếu cần → lên lịch nhắc/cảnh báo)
        │
        ▼
UI cập nhật → viên pin Protein đầy lên
```

---

## ⏰ Tác vụ nền tự động

| Tác vụ | Khi nào chạy | Việc làm |
|--------|--------------|----------|
| **Daily reset** | Đầu mỗi ngày | Tạo pin ngày mới theo mục tiêu của Mode |
| **Depletion tick** | Định kỳ trong ngày | Giảm các pin nhỏ theo thời gian + Mode. ⚠️ S-M (2026-07-03): "Sổ calo" đếm LÊN, không tự xả. ♻️ S-O/S-P/S-Q (2026-07-04, đang làm): **Pin no/đói** (headline) TỤT DẦN lại theo nhịp sinh học (thức/ngủ), có sàn 15-20%; **Sổ calo** (dòng phụ) đếm lên, **reset 6h sáng** |
| **Low battery check** | Định kỳ | Nếu pin thấp → nhắc nhở |
| **Weekly export** | Mỗi tuần | Xuất Excel ra điện thoại |
| **Cleanup** | Sau export | Xoá dữ liệu cũ > 1 tuần khỏi app |

---

## 🔐 Nguyên tắc riêng tư

- Mặc định **mọi dữ liệu nằm trên máy**, không gửi đi đâu.
- Diary mã hoá, app không đọc lại để phân tích.
- Khi tích hợp Health: chỉ lấy khi người dùng đồng ý, và nêu rõ lấy gì.
