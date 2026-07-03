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
└── lib/                # Tiện ích chung (ngày tháng, mã hoá, metabolicConstants)
```

**Ngoài `src/` (gốc repo):**
- `scripts/` — script Node sinh dữ liệu món ăn (`gen:food`, `gen:usda`), chạy trước khi start.
- `database/` — dữ liệu USDA: `raw/` (file gốc 6.4MB, KHÔNG commit) + `extract/` (CSV gọn, có commit).
- `.ai/` — luật dự án, skills, agents, báo cáo song song. `.claude/` — cấu hình Claude Code
  (native subagents + hooks lint tự động, xem `.ai/CONTEXT.md` mục 6).
- `services/health/` chưa tồn tại — sẽ tạo khi tích hợp HealthKit/Health Connect (S-F v2).

---

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
