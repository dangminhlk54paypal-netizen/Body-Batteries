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

## 📁 Cấu trúc thư mục mã nguồn (sẽ tạo ở Phase 0)

```
src/
├── screens/            # Các màn hình (Home, History, Settings, Diary...)
├── components/         # Khối tái sử dụng (BatteryCell, BatteryStack...)
├── store/              # Zustand: energyStore, settingsStore...
├── domain/
│   ├── battery/        # "Battery engine": tính mức pin, nạp, xả
│   ├── modes/          # Định nghĩa các Mode và ảnh hưởng
│   └── rules/          # Quy tắc nhắc nhở/cảnh báo
├── data/
│   ├── db/             # Khởi tạo SQLite, schema
│   └── repositories/   # Đọc/ghi dữ liệu (batteryRepo, intakeRepo...)
├── services/
│   ├── notifications/  # Nhắc nhở, cảnh báo
│   ├── export/         # Xuất Excel
│   ├── cleanup/        # Tự xoá dữ liệu > 1 tuần
│   └── health/         # (sau) Tích hợp đồng hồ/health
└── lib/                # Tiện ích chung (ngày tháng, mã hoá...)
```

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
| **Daily reset** | Đầu mỗi ngày | Nạp lại pin theo mục tiêu của Mode |
| **Depletion tick** | Định kỳ trong ngày | Giảm pin theo thời gian + Mode |
| **Low battery check** | Định kỳ | Nếu pin thấp → nhắc nhở |
| **Weekly export** | Mỗi tuần | Xuất Excel ra điện thoại |
| **Cleanup** | Sau export | Xoá dữ liệu cũ > 1 tuần khỏi app |

---

## 🔐 Nguyên tắc riêng tư

- Mặc định **mọi dữ liệu nằm trên máy**, không gửi đi đâu.
- Diary mã hoá, app không đọc lại để phân tích.
- Khi tích hợp Health: chỉ lấy khi người dùng đồng ý, và nêu rõ lấy gì.
