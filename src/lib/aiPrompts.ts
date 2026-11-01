// Copy-paste prompts for external AI chats (ChatGPT, Claude, Gemini, …).
// Keep in sync with docs/08-ai-prompt-guide.md and the BB-LOG v1 parser in
// src/domain/food/aiMealLog.ts.

export const AI_PLATFORMS: { name: string; url: string }[] = [
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
  { name: 'Copilot', url: 'https://copilot.microsoft.com' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com' },
];

export const MEAL_LOG_PROMPT = `Bạn là trợ lý dinh dưỡng. Hãy chuyển lời kể của tôi thành nhật ký ăn uống.

QUY TẮC:
- Mỗi món ăn/đồ uống là 1 dòng, theo đúng định dạng:
  HH:MM | Tên món tiếng Việt | gram | kcal | đạm_g | tinh_bột_g | béo_g | nước_ml
- Giờ theo 24h. Nếu tôi không nói giờ: sáng=07:00, trưa=12:00, chiều=15:00, tối=19:00.
- Đổi khẩu phần sang gram (1 chén cơm ≈150 g, 1 bát/tô ≈250–500 g, 1 ly ≈250–500 ml…).
- Số làm tròn tới số nguyên. Đồ uống: ghi gram = ml.
- Món hỗn hợp (phở, bún, cơm tấm…) ghi thành 1 dòng cho cả phần.
- Chỉ trả về đúng 1 khối code, không giải thích. Dòng đầu là: BB-LOG v1

LỜI KỂ CỦA TÔI:
`;

export const NEW_FOOD_PROMPT = `Bạn là chuyên gia dinh dưỡng. Hãy tạo dữ liệu dinh dưỡng cho món ăn dưới đây.

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
`;

export const FIX_FORMAT_PROMPT =
  'Sai định dạng. Chỉ trả về đúng 1 khối code theo QUY TẮC ở trên, không thêm chữ nào khác.';
