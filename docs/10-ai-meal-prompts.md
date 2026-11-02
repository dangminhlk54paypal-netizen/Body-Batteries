# 10 · Nhờ AI ghi món (BB-LOG v1)

Nạp bằng chữ › 🤖 Nhờ AI ghi món: chép câu lệnh, mở AI, dán câu trả lời vào ô rồi bấm Dán. Đủ 3 ngôn ngữ (`components.aiMealGuide`).

```text
BB-LOG v1
HH:MM | Tên món | gram | kcal | đạm_g | tinh_bột_g | béo_g | nước_ml
```

- `domain/food/aiImport/bbLog.ts` đọc khối này; `parseMealAnswer` biến thành dòng xem lại như câu trả lời JSON: sửa được, chọn số của app hoặc của AI, lưu thành món của tôi.
- Câu lệnh "Tạo món mới (CSV)" cho dòng dữ liệu theo cột của `food_items.csv`.
- **Việc sau:** khi `bb.food.v1` xong (`.ai/plans/2026-10-26-ai-import-ke-lai-mon-ghep.md`), hợp nhất hai định dạng rồi xoá phần dư.
