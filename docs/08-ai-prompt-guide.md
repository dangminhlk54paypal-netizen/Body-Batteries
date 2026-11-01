# 08 — Dùng AI để "dịch" lời kể thành dữ liệu cho app

> Khi bạn muốn kể bữa ăn bằng lời ("trưa nay ăn 1 tô phở bò, uống ly trà sữa")
> hoặc gặp **món mới chưa có trong app**, hãy nhờ AI làm "enzim": biến lời văn
> thành dòng dữ liệu đúng định dạng để đưa vào hệ thống.
>
> ⚠️ Số liệu AI đưa ra là **ước lượng** — kiểm tra lại trước khi lưu.

---

## Cách dùng (3 bước)
1. Mở một nền tảng AI bên dưới, bắt đầu **cuộc trò chuyện mới**.
2. **Copy nguyên khối prompt** (Mẫu A hoặc B), thay phần `<<...>>` bằng lời của bạn, gửi đi.
3. Copy khối kết quả AI trả về → nhập vào app.

## Nền tảng gợi ý
Dùng bản mới nhất có trong tài khoản; bản miễn phí đều làm được.

| Nền tảng | Địa chỉ | Ghi chú |
|---|---|---|
| ChatGPT | chatgpt.com | Phổ biến, gửi được ảnh món ăn |
| Claude | claude.ai | Tuân thủ định dạng rất chặt |
| Gemini | gemini.google.com | Có sẵn với tài khoản Google |
| Copilot | copilot.microsoft.com | Có sẵn trên Windows/Edge |
| DeepSeek | chat.deepseek.com | Miễn phí, mạnh về số liệu |

**Mẹo:** gửi kèm **ảnh chụp món ăn** cũng được (với nền tảng hỗ trợ ảnh) — AI sẽ tự ước lượng gram.

---

## Mẫu A — Ghi bữa ăn từ lời kể
Dùng khi muốn ghi nhiều món cùng lúc, có giờ ăn và khẩu phần.

```text
Bạn là trợ lý dinh dưỡng. Hãy chuyển lời kể của tôi thành nhật ký ăn uống.

QUY TẮC:
- Mỗi món ăn/đồ uống là 1 dòng, theo đúng định dạng:
  HH:MM | Tên món tiếng Việt | gram | kcal | đạm_g | tinh_bột_g | béo_g | nước_ml
- Giờ theo 24h. Nếu tôi không nói giờ: sáng=07:00, trưa=12:00, chiều=15:00, tối=19:00.
- Đổi khẩu phần sang gram (1 chén cơm ≈150 g, 1 bát/tô ≈250–500 g, 1 ly ≈250–500 ml…).
- Số làm tròn tới số nguyên. Đồ uống: ghi gram = ml.
- Món hỗn hợp (phở, bún, cơm tấm…) ghi thành 1 dòng cho cả phần.
- Chỉ trả về đúng 1 khối code, không giải thích. Dòng đầu là: BB-LOG v1

LỜI KỂ CỦA TÔI:
<<Ví dụ: Sáng ăn 1 ổ bánh mì trứng với ly cà phê sữa đá. Trưa 1 tô phở bò tái lớn.>>
```

**Kết quả mong đợi:**
```text
BB-LOG v1
07:00 | Bánh mì trứng | 150 | 380 | 14 | 45 | 15 | 40
07:00 | Cà phê sữa đá | 250 | 120 | 2 | 20 | 4 | 220
12:00 | Phở bò tái (tô lớn) | 600 | 550 | 30 | 70 | 15 | 450
```

**Nhập vào app (hiện tại):** với mỗi dòng → nếu món có trong danh sách thì
**🍱 Ghi món ăn** (nhập gram + giờ); nếu không có thì **🍽️ Ăn thêm kcal** (nhập kcal).

---

## Mẫu B — Tạo món mới cho cơ sở dữ liệu
Dùng khi món **chưa có trong app**. Kết quả là 1 dòng CSV dán thẳng vào `food_items.csv`.

```text
Bạn là chuyên gia dinh dưỡng. Hãy tạo dữ liệu dinh dưỡng cho món ăn dưới đây.

QUY TẮC:
- Trả về đúng 1 khối code CSV gồm dòng tiêu đề này và 1 dòng dữ liệu:
id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note
- MỌI chỉ số dinh dưỡng tính trên 100 g (không phải trên 1 phần).
- id: tiếng Anh, chữ thường, nối bằng dấu gạch dưới (vd: bun_bo_hue).
- category: chọn 1 trong grain, meat, fish, egg_dairy, legume_nut, vegetable, fruit, fat_sugar, dish.
- default_serving_g: gram của 1 phần thường ăn.
- serving_presets: dạng nhãn=gram nối bằng | (vd: chén=150|tô=500).
- Tên có dấu phẩy thì đặt trong ngoặc kép. Không biết số nào thì để trống.
- source ghi: AI-estimate. note: ghi ngắn nguồn tham khảo hoặc giả định.
- Không giải thích gì thêm ngoài khối code.

MÓN ĂN:
<<Ví dụ: Bún bò Huế, 1 tô thường khoảng 500 g>>
```

**Kết quả mong đợi:**
```text
id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,...
bun_bo_hue,Bún bò Huế,Hue spicy beef noodle soup,dish,500,tô=500|tô nhỏ=350,95,...
```

**Nhập vào app (hiện tại):** dán **dòng dữ liệu** (bỏ dòng tiêu đề) vào cuối
`food_items.csv` → chạy `npm run gen:food` → món xuất hiện trong **🍱 Ghi món ăn**.

---

## Khi AI trả sai định dạng
Gửi tiếp câu này trong cùng cuộc trò chuyện:
```text
Sai định dạng. Chỉ trả về đúng 1 khối code theo QUY TẮC ở trên, không thêm chữ nào khác.
```

## Ghi chú cho phát triển
- `BB-LOG v1` được thiết kế để sau này app có thể **dán thẳng** (parse theo `|`,
  khớp tên món với `name_vi`; không khớp → ghi theo kcal).
- Mẫu B khớp 100% header của `food_items.csv` (parser `parseFoodCsv` đọc theo tên cột).
