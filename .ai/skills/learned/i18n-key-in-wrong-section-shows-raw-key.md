# Khoá i18n đặt nhầm mục → màn hình hiện tên khoá thô

**Bối cảnh:** Session 41 thêm `changeTitle`, `bodyWeightSource.*` cho biểu đồ Tiến độ sức mạnh
(`TrainingProgressChart`), nhưng lại dán vào `export.strength` (Excel) thay vì `trainingLog.progress`.
**Triệu chứng:** dưới biểu đồ hiện nguyên chữ `trainingLog.progress.changeTitle`. `tsc` vẫn xanh.
**Nguyên nhân gốc:** `t()` nhận chuỗi bất kỳ, nên kiểu `typeof vi` chỉ bắt được khoá thiếu **giữa các ngôn ngữ**,
không bắt được khoá mà code gọi nhưng không có trong từ điển.
**Cách sửa đúng:** chuyển khoá về đúng mục trong cả vi/en/de. Test `src/i18n/__tests__/usedKeys.test.ts` quét mọi
`t('a.b')` / `t(language, 'a.b')` literal trong `src` và đòi có chữ ở cả 3 ngôn ngữ.
**Dấu hiệu nhận biết lần sau:** thêm khoá xong thì chạy `npx jest src/i18n`. Khoá dựng bằng template
(`` t(`x.${id}`) ``) test không thấy, nên phải tự kiểm tra id.
