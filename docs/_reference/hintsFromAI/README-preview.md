# 🔋 My Body Batteries

> Một app di động theo dõi "năng lượng cơ thể" giống như cách pin xe điện thông minh hiển thị mức sạc/xả.

Đây là **tài liệu gốc của dự án** (project source-of-truth). Bất kỳ con người hay AI nào bắt đầu làm việc với dự án này đều phải đọc tài liệu ở đây trước khi viết một dòng code.

---

## 📖 Bắt đầu từ đâu? (dành cho người non-tech)

Đọc theo đúng thứ tự này:

| Bước | File | Nội dung |
|------|------|----------|
| 1 | [`docs/01-vision-and-features.md`](docs/01-vision-and-features.md) | Ý tưởng & toàn bộ tính năng |
| 2 | [`docs/02-tech-stack.md`](docs/02-tech-stack.md) | Dùng công nghệ gì, vì sao (giải thích đơn giản) |
| 3 | [`docs/03-architecture.md`](docs/03-architecture.md) | Cấu trúc hệ thống & mô hình dữ liệu |
| 4 | [`docs/04-roadmap.md`](docs/04-roadmap.md) | Lộ trình & tiến độ theo từng giai đoạn |
| 5 | [`.ai/CONTEXT.md`](.ai/CONTEXT.md) | **Luật chơi** khi làm việc với AI (đọc kỹ!) |

---

## 🤖 Cách làm việc với AI (Claude / Gemini trong VS Code)

Mỗi khi bắt đầu một phiên làm việc mới (session), bạn làm như sau:

1. Mở dự án trong VS Code.
2. Mở khung chat của extension AI (Claude hoặc Gemini).
3. Gõ câu lệnh khởi động này (copy nguyên văn):

```
Hãy đọc file .ai/CONTEXT.md để hiểu luật làm việc của dự án này.
Sau đó đọc docs/04-roadmap.md và cho tôi biết chúng ta đang ở Phase nào,
việc tiếp theo cần làm là gì. Nói chuyện với tôi bằng tiếng Việt,
nhưng viết code và comment hoàn toàn bằng tiếng Anh.
```

4. AI sẽ tự định hướng và bắt đầu cùng bạn.

> 💡 **Nguyên tắc vàng:** Bạn không cần biết code. Việc của bạn là *mô tả mong muốn bằng tiếng Việt* và *kiểm tra kết quả trên điện thoại*. Việc của AI là dịch mong muốn đó thành code.

---

## 🗂️ Cấu trúc thư mục

```
my-body-batteries/
├── README.md                      ← Bạn đang ở đây
├── docs/                          ← Tài liệu cho con người đọc
│   ├── 01-vision-and-features.md
│   ├── 02-tech-stack.md
│   ├── 03-architecture.md
│   └── 04-roadmap.md
├── .ai/                           ← "Bộ não" hướng dẫn AI
│   ├── CONTEXT.md                 ← Luật chơi tổng (AI đọc đầu tiên)
│   ├── agents/                    ← Các "nhân vật AI" với vai trò riêng
│   └── skills/                    ← Các kỹ năng tái sử dụng
└── (mã nguồn app sẽ được tạo sau, trong Phase 0)
```

---

## ⚠️ Lưu ý quan trọng về sức khoẻ

App này là công cụ **theo dõi & tạo động lực cá nhân**, KHÔNG phải thiết bị y tế.
Mọi tính năng "dự báo sức khoẻ" chỉ mang tính tham khảo và không thay thế bác sĩ.
Chi tiết xem trong [`docs/01-vision-and-features.md`](docs/01-vision-and-features.md).
