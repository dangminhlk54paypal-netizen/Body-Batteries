# S-G · Lớp thông minh dinh dưỡng (Phase 5) — SPEC

> **Trạng thái:** 🆕 Đã chốt hướng với người dùng (2026-07-31, nghiên cứu + duyệt qua Plan mode).
> **CHƯA code** — đây là spec để một phiên sau (Sonnet/data-ml) đọc rồi làm. Chia thành các gói
> con nhỏ (`S-G1`, `S-G2`, `S-G3a`…`S-G3e`) để mỗi gói vừa trong ngân sách token của 1 phiên.
>
> Đây là spec cho luồng **"xu hướng dinh dưỡng ăn uống"** — một trong 2 việc dưới mã `S-G`.
> Luồng còn lại ("hiệu chỉnh MET cá nhân hoá theo cân nặng thật", dùng dữ liệu `S-L`) đã mô tả
> riêng ở `.ai/NEXT_SESSIONS.md:736-740`, KHÔNG nằm trong spec này, không bị ảnh hưởng.
>
> **⚠️ Điều kiện chờ "cần dữ liệu cân nặng từ S-L" đã được gỡ** — `S-L` xong từ 2026-06-18
> (`.ai/NEXT_SESSIONS.md:65`). Vẫn giữ nguyên tắc "cần ~1 tháng dữ liệu thật trước khi HIỂN THỊ
> xu hướng cho người dùng" ở tầng UI/tính năng — nhưng việc xây engine/hạ tầng (S-G1, S-G2, phần
> lớn S-G3) có thể bắt đầu ngay, không cần chờ.

---

## 1. Bối cảnh & vấn đề

Roadmap (`docs/04-roadmap.md:158-169`) đã định hình Phase 5: "dự báo xu hướng (KHÔNG chẩn đoán
bệnh)", theo thứ tự rule-based trước → hồi quy/TensorFlow Lite on-device sau → gợi ý cá nhân hoá
kèm disclaimer y tế. `docs/01-vision-and-features.md:108-117` quy định ranh giới sức khoẻ bắt
buộc: không phải thiết bị y tế, không chẩn đoán, luôn diễn đạt thành "xu hướng/mẫu hình", luôn
kèm "chỉ tham khảo, hãy gặp chuyên gia y tế".

App đã có sẵn một engine rule-based **chỉ tính cho hôm nay**:
`src/domain/nutrition/nutritionAssessment.ts` — dùng bộ ngưỡng có nguồn (NIH ODS/WHO/USDA-HHS
DRI) để sinh lời khuyên nhẹ nhàng ("hơi thấp — thử thêm...", không bao giờ "thiếu hụt"/"nguy cơ
bệnh"). `src/types/nutrition.ts:1-3` ghi rõ đây là số liệu **DERIVED, today-only, không có bảng
DB lưu lịch sử**.

**Hai vấn đề nền tảng phải giải quyết trước khi làm xu hướng nhiều tuần/tháng:**

1. Vi chất (natri, kali, sắt, canxi, đường, xơ...) **không lưu per-entry** trong `food_log` —
   chỉ tính lại từ catalog × grams mỗi lần xem/export (`excelSheets.ts:146-151`). Không có bảng
   nào lưu lịch sử vi chất theo ngày.
2. `food_log` chỉ đảm bảo giữ **~35 ngày** theo mặc định — `DATA_RETENTION_DAYS = 35`
   (`src/lib/constants.ts:136`), xoá qua nút Settings người dùng tự xác nhận
   (`src/services/cleanup/cleanupService.ts`). Một tính năng xu hướng 3-6 tháng không có gì đảm
   bảo dữ liệu thô còn tồn tại đến lúc đó.

→ Cả hai vấn đề được giải quyết bằng **một bảng tổng hợp mới, bền vững** (xem `S-G1`), độc lập
với chu kỳ dọn dẹp 35 ngày của `food_log`.

**Vấn đề cốt lõi về ML (lý do Lớp 3 KHÔNG train trên dữ liệu app):** dữ liệu 1 người dùng (6
tháng ≈ 180 điểm/ngày) quá nhỏ để train một mạng neuron từ đầu ra kết quả tin cậy, và không có
nhãn kết quả y tế thật để học có giám sát. Nghiên cứu ML dinh dưỡng thật (NHANES) luôn dùng hàng
nghìn–hàng chục nghìn người để học mối liên hệ dinh dưỡng↔nguy cơ trước, rồi mới suy luận
(không train lại) lên từng cá nhân — `S-G3` đi đúng thứ tự này.

---

## 2. Hướng đã chốt (không bàn lại)

1. **3 lớp, làm tăng dần, lớp sau không thay thế lớp trước:** rule-based rolling window (`S-G1`)
   → thang điểm y văn công khai HEI-2020/DASH (`S-G2`) → model nhỏ pretrain trên dữ liệu quần
   thể, suy luận on-device (`S-G3`). Mỗi lớp tự đứng được, không bắt buộc phải làm hết cả 3 mới
   có giá trị.
2. **Lớp 3 train OFFLINE, ngoài app**, trên dữ liệu quần thể công khai (NHANES) — không train
   trên dữ liệu cá nhân của người dùng. App chỉ **suy luận (inference)** một model đã train sẵn.
3. **Ưu tiên không-NN nếu NN không thắng rõ rệt.** Nghiên cứu NHANES 2025 (cardiovascular risk,
   MASLD…) cho thấy XGBoost/Random Forest thường thắng NN thuần trên dữ liệu dạng bảng — `S-G3c`
   phải so sánh baseline trước khi quyết định giữ kiến trúc NN.
4. **Không thêm dependency ML native (TensorFlow.js/ONNX) nếu tránh được** — xem lý do ở mục 5.
5. Mọi output hiển thị cho người dùng phải qua layering i18n hiện có (`t('...')`, 3 ngôn ngữ,
   disclaimer `t('assessment.disclaimer')`), không hardcode string, không dùng từ "chẩn đoán"/
   "nguy cơ bệnh X%".

---

## 3. S-G1 · Rule-based rolling window — làm được ngay, không cần ML

**Mục tiêu:** mở rộng `nutritionAssessment.ts` + `microBatteryEngine.ts` từ "chỉ hôm nay" sang
trung bình động 7/30 ngày + đếm streak vượt ngưỡng liên tục N ngày, dùng lại đúng bộ ngưỡng có
nguồn đã có.

**Việc cần làm:**
- Bảng SQLite mới `daily_nutrition_summary` (1 dòng/ngày: macro + vi chất đã tính sẵn) trong
  `src/data/db/schema.ts` + migration — **độc lập với `food_log`**, không bị `DATA_RETENTION_DAYS`
  đụng tới.
- Repository mới trong `src/data/repositories/` (CRUD giống pattern `foodLogRepository.ts`).
- Job ghi 1 dòng tổng hợp mỗi ngày — mirror pattern job reset/cleanup đã có, **không tự xoá dữ
  liệu cũ**.
- Hàm rolling-average + streak-detection thuần TypeScript (không thư viện ngoài) trong
  `src/domain/nutrition/`.
- Lời khuyên qua `src/i18n/locales/{vi,en,de}.ts`, disclaimer bắt buộc.

**File chạm chính:** `src/data/db/schema.ts`, `src/data/repositories/` (mới),
`src/domain/nutrition/nutritionAssessment.ts`, `src/domain/nutrition/microBatteryEngine.ts`,
`src/i18n/locales/*.ts`.

**Agent phụ trách:** `logic-backend` (schema + domain), sau đó `mobile-frontend` nếu cần hiển thị
UI riêng cho xu hướng.

**Tiêu chí hoàn thành:** tính được ít nhất 1 xu hướng thật từ dữ liệu giả lập trong test (vd.
"natri vượt mức gợi ý 14/30 ngày qua"), kèm disclaimer, `npm run verify` sạch.

---

## 4. S-G2 · Thang điểm y văn công khai (HEI-2020 / DASH)

**Mục tiêu:** thêm công thức tính điểm ăn uống đã công bố (không tự nghĩ ngưỡng), cho phép diễn
giải có căn cứ khoa học mà vẫn giữ khung "xu hướng, không chẩn đoán".

**Việc cần làm:** hàm tính điểm thuần TS trong `src/domain/nutrition/`, input = dữ liệu từ
`daily_nutrition_summary` (S-G1). Nguồn công thức ghi comment + `sourceUrl`, giống pattern
`NutrientAssessmentRule` (`nutritionAssessment.ts:24-37`).

**Phụ thuộc:** `S-G1` (cần bảng tổng hợp lịch sử trước).

**Tiêu chí hoàn thành:** điểm HEI/DASH tính đúng trên tập test cố định, có trích dẫn nguồn.

---

## 5. S-G3 · Model nhỏ pretrain trên dữ liệu quần thể, suy luận on-device

### 5.1 Subfolder mới: `ml-nutrition-risk/` (gốc repo, ngang hàng `database/`)

```
ml-nutrition-risk/
  raw/            ← NHANES tải về (nặng, KHÔNG commit — thêm dòng .gitignore
                    giống "database/raw/*.json" hiện có)
  extract/        ← bảng đặc trưng đã làm sạch, khớp field app đang track (CÓ commit, gọn)
  train/          ← script Python: thu thập, feature engineering, train, so sánh model
  models/         ← model nhỏ nhất đạt yêu cầu, xuất JSON weights (CÓ commit, vài KB–vài trăm KB)
  README.md       ← mirror database/README.md: nguồn dữ liệu, cách chạy lại, LƯU Ý pipeline
                    offline, không phải code chạy trong app
```

**⚠️ Giống cảnh báo ở `S-N-food-data-usda-spec.md:7-9` về file JSON 6.4MB:** nếu file NHANES tải
về nặng, KHÔNG đọc trực tiếp bằng công cụ đọc file — chỉ chạm qua script Python/Node.

### 5.2 Vì sao JSON weights + JS thuần, không phải TensorFlow.js/ONNX

`AGENTS.md` khoá app ở Expo SDK 54, khớp bản Expo Go trên điện thoại test, không nâng cấp tuỳ
tiện. ONNX Runtime React Native cần `expo prebuild` + custom dev client (giống tình huống
HealthKit hiện đang vướng — `docs/04-roadmap.md:181`: "CODE XONG... KHÔNG chạy qua Expo Go"),
phá khả năng chạy Expo Go thuần. TensorFlow.js chạy được trong Expo Go nhưng vẫn là dependency
mới, nặng hơn cần thiết cho một MLP vài trăm tham số. Với model nhỏ cỡ này, tự viết forward-pass
(~20-30 dòng: nhân ma trận + activation, đọc trọng số từ JSON) là lựa chọn rẻ nhất — zero
dependency mới, không phá Expo Go.

### 5.3 Các gói con (mỗi gói ~1 phiên riêng)

- **`S-G3a`** — Khởi tạo `ml-nutrition-risk/` (cấu trúc thư mục + `README.md` khung sẵn + thêm
  dòng `.gitignore`). Người dùng tự tải tập con NHANES cần thiết vào `raw/` (giống cách đã làm
  với file USDA JSON 6.4MB trước đây ở `S-N` — không để AI tự tải file lớn).
- **`S-G3b`** — Script Python feature engineering: ánh xạ đặc trưng NHANES sang đúng field app
  đang có (macro theo `Nutrition`/`food_items.csv` header, vi chất theo `MicronutrientId` ở
  `src/types/nutrition.ts`) — để input suy luận sau này khớp dữ liệu thật của app.
- **`S-G3c`** — Train + so sánh baseline (logistic regression) vs XGBoost vs MLP nhỏ trên tập
  NHANES đã xử lý. **Chỉ giữ kiến trúc NN nếu vượt baseline rõ rệt** trên tập validation.
- **`S-G3d`** — Xuất model đã chọn ra `models/*.json` (ma trận trọng số thuần).
- **`S-G3e`** — Viết forward-pass JS thuần trong `src/domain/nutrition/`, đọc `models/*.json` lúc
  build, suy luận trên `daily_nutrition_summary` (từ `S-G1`). Output qua i18n + disclaimer,
  **không bao giờ** dùng từ "chẩn đoán"/"nguy cơ bệnh X%" — chỉ "xu hướng/mẫu hình, hãy cân nhắc
  gặp bác sĩ".

**Phụ thuộc:** `S-G3e` cần `S-G1` đã xong (cần bảng tổng hợp làm input suy luận). `S-G3a-d` độc
lập, có thể làm trước/song song `S-G1`/`S-G2` vì không đụng `src/`.

**Agent phụ trách:** `data-ml` cho toàn bộ `S-G3`.

---

## 6. Verification

Áp dụng cho `S-G1`, `S-G2`, `S-G3e` (mọi gói đụng `src/`) — theo đúng gate đã quy định cho các
gói khác (`.ai/NEXT_SESSIONS.md:36-43`):

```bash
cd /Users/minh/VSCode_Repo/BodyBatteries
npx tsc --noEmit
export PATH="/opt/homebrew/bin:$PATH"
npx expo export --platform ios --output-dir /tmp/check_<mã-gói>
npm test
```

`S-G3a-d` (phần Python, không đụng app) không cần lệnh trên, nhưng `README.md` trong
`ml-nutrition-risk/` phải nêu rõ đây là pipeline offline, không bundle vào app.

Mỗi gói ghi báo cáo vào `.ai/parallel-reports/<mã-gói>.md` (vd `S-G1.md`), không sửa
`SESSION_LOG.md` trong lúc chạy riêng lẻ.

---

## 7. Tiêu chí hoàn thành chung của S-G (luồng xu hướng dinh dưỡng)

App đưa ra được ít nhất 1 gợi ý xu hướng có ích, có disclaimer y tế đầy đủ, đúng tiêu chí đã ghi
ở `docs/04-roadmap.md:166`. `S-G1` một mình đã đủ đạt tiêu chí này — `S-G2`/`S-G3` là mở rộng
thêm chiều sâu, không bắt buộc để coi `S-G` là "có giá trị".