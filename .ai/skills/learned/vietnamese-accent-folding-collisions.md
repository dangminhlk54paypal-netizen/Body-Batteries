# Bỏ dấu tiếng Việt làm các từ khác nghĩa trùng nhau

**Bối cảnh:** Session 70, bộ đọc câu "Nạp bằng chữ" (`src/domain/food/mealText/`). Câu phải hiểu được cả khi gõ có dấu lẫn
không dấu, nên từ khoá được so ở dạng đã bỏ dấu (`foldWord`, giống `normalize` của ô tìm món).

**Triệu chứng:**
- "tôi đã ăn **tỏi**" → mất món tỏi, câu bị hiểu thành bữa tối: "ăn tỏi" bỏ dấu = "an toi" = cụm "ăn tối".
- Danh sách từ đệm bỏ dấu nuốt mất tên món: "tôi"→"toi" nuốt "tỏi", "đã"→"da" nuốt "đá" (trà đá), "chừng"→"chung" nuốt
  "chưng" (bánh chưng), "ca" (circa, tiếng Đức) nuốt "cá".
- Số viết bằng chữ nằm trong tên món: "**ba** chỉ nướng" → 3 × "chỉ nướng" (khớp nhầm thịt bò nhờ chịu lỗi gõ), "cá ba sa".

**Nguyên nhân gốc:** bỏ dấu là phép rút gọn **nhiều-về-một**. Các cặp khác nghĩa trùng nhau sau khi bỏ dấu: tối/tôi/tỏi
→ toi, năm/nắm → nam, mười/muối → muoi, sáu/sau → sau, đã/đá → da. Một từ khoá chỉ được so ở dạng bỏ dấu khi nó không
đụng với từ nào khác.

**Cách sửa đúng:**
1. Từ khoá mặc định so **có dấu** (`FILLER_WORDS_ACCENTED`, cụm giờ có dấu). Chỉ những từ vẫn rõ nghĩa khi bỏ dấu mới có
   bản không dấu ("hom qua", "chieu", "bua sang").
2. Bản không dấu **chỉ khớp chữ được gõ không dấu tiếng Việt**: `!/[^ -~äöüß]/.test(tok)`. Umlaut tiếng Đức vẫn được, để
   "Frühstück" khớp "fruhstuck".
3. Số viết bằng chữ có thể là tên món: giữ một `fallbackQuery` (cả cụm, còn nguyên chữ số). Mapper thử cụm đó **trước**
   cách hiểu "3 phần", kể cả các dạng bớt chữ cuối ("ba chỉ nướng" → "ba chỉ", tối thiểu 2 từ để "hai" đứng một mình
   không thành tên). Lý do phải thử trước: phần còn lại ("chỉ nướng") vẫn có thể khớp nhầm một món khác nhờ chịu lỗi gõ.
4. Viết test bằng câu thật cho từng cặp trùng (`parseMealText.test.ts`, `mealTextSearch.test.ts` chạy trên kho món thật).

**Dấu hiệu nhận biết lần sau:** thêm một danh sách từ khoá tiếng Việt mà so sau khi đã `normalize` / `foldWord` → kiểm
tra ngay xem bản bỏ dấu có trùng một từ tiếng Việt thông dụng khác không (nhất là tên món: tỏi, đá, chưng, cá, muối).
