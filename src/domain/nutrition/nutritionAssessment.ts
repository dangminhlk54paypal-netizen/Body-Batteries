import type { MicronutrientId, MicroBatteryState } from '../../types/nutrition';

// Pure, self-tracking "assessment" layer on top of the micronutrient-battery
// engine (see microBatteryEngine.ts). This produces gentle, Vietnamese
// suggestion text — NEVER a diagnosis or medical claim (see
// docs/01-vision-and-features.md §health, and AGENTS.md health boundary).
//
// Every screen/sheet that shows this text must also show the disclaimer:
// "Chỉ để tham khảo — không phải tư vấn y tế." (added by the caller, not
// repeated per-line here).
//
// Wording rule: "Hơi ít {chất} — gợi ý: {ví dụ}" is OK; "thiếu chất" /
// "nguy cơ bệnh" is NOT OK. Same for limits: "vượt ngưỡng gợi ý — thử giảm
// {ví dụ}" is OK; alarming words are not.

export interface NutrientAssessmentRule {
  id: MicronutrientId;
  // Fraction of target below which a 'goal' nutrient gets a gentle
  // "add more" suggestion (e.g. 0.7 = under 70% of the daily target).
  underThreshold?: number;
  underAdviceVi?: string;
  // Fraction of target above which either kind gets a neutral "over" note
  // ('goal': past the recommendation, still framed as harmless from food;
  // 'limit': past the suggested cap, framed as a gentle nudge to cut back).
  overThreshold?: number;
  overAdviceVi?: string;
  // Reputable source backing the threshold/advice above (NIH ODS fact sheet,
  // WHO guideline, or USDA/HHS Dietary Guidelines for Americans — DRI-based).
  // Also copied into the Excel "Bảng ngưỡng tham chiếu" sheet.
  sourceUrl: string;
}

// --- Rule table --------------------------------------------------------
// vòng 2 note (per S-Q/S-R task brief): every URL below was looked up via
// WebSearch against NIH ODS / WHO / USDA sources on 2026-07-07. The dev
// should still click through and re-confirm before shipping (vòng 2).
export const ASSESSMENT_RULES: Record<MicronutrientId, NutrientAssessmentRule> = {
  fiber: {
    id: 'fiber',
    underThreshold: 0.7,
    underAdviceVi:
      'Hơi ít chất xơ — thử thêm rau xanh, trái cây, yến mạch hoặc các loại đậu.',
    overThreshold: 1.0,
    overAdviceVi: 'Chất xơ đã vượt mức khuyến nghị — vậy là tốt, cứ tiếp tục ăn nhiều rau củ.',
    // USDA/HHS Dietary Guidelines for Americans 2020-2025 (fiber is listed as
    // a "nutrient of public health concern"; AI values ~25-38g/day by
    // sex/age, sourced from the IOM/NASEM DRI).
    sourceUrl:
      'https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf',
  },
  iron: {
    id: 'iron',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít sắt — thử thêm thịt đỏ, gan, đậu lăng hoặc rau bina.',
    overThreshold: 1.0,
    overAdviceVi:
      'Sắt đã vượt mức khuyến nghị — nếu không dùng thêm viên uống bổ sung thì không đáng lo.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/',
  },
  calcium: {
    id: 'calcium',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít canxi — thử thêm sữa, sữa chua, đậu phụ hoặc cá nhỏ ăn cả xương.',
    overThreshold: 1.0,
    overAdviceVi:
      'Canxi đã vượt mức khuyến nghị — thường ổn từ thực phẩm, chỉ cần lưu ý nếu có dùng thêm viên canxi.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/',
  },
  fat: {
    id: 'fat',
    underThreshold: 0.7,
    underAdviceVi:
      'Hơi ít chất béo — thử thêm dầu ô liu, cá béo hoặc các loại hạt (miễn đủ năng lượng cả ngày).',
    overThreshold: 1.0,
    overAdviceVi: 'Chất béo đã vượt mức khuyến nghị — thử giảm bớt đồ chiên rán, mỡ động vật.',
    // USDA/HHS Dietary Guidelines for Americans 2020-2025 — Acceptable
    // Macronutrient Distribution Range (AMDR) for total fat: 20-35% of
    // calories for adults.
    sourceUrl:
      'https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf',
  },
  potassium: {
    id: 'potassium',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít kali — thử thêm chuối, khoai lang, rau bina hoặc cam.',
    overThreshold: 1.0,
    overAdviceVi: 'Kali đã vượt mức khuyến nghị — thường ổn khi đến từ thực phẩm tự nhiên.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/',
  },
  magnesium: {
    id: 'magnesium',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít magie — thử thêm hạt bí, hạnh nhân, rau bina hoặc đậu đen.',
    overThreshold: 1.0,
    overAdviceVi:
      'Magie đã vượt mức khuyến nghị — từ thực phẩm thì không đáng ngại, chỉ cần chú ý nếu dùng thêm viên uống bổ sung.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/',
  },
  zinc: {
    id: 'zinc',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít kẽm — thử thêm hàu, thịt bò, hạt bí hoặc đậu gà.',
    overThreshold: 1.0,
    overAdviceVi:
      'Kẽm đã vượt mức khuyến nghị — nếu không dùng thêm viên uống bổ sung thì không đáng lo.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/',
  },
  omega3: {
    id: 'omega3',
    underThreshold: 0.7,
    underAdviceVi: 'Hơi ít omega-3 — thử thêm cá hồi, cá thu, hạt chia hoặc dầu cá.',
    overThreshold: 1.0,
    overAdviceVi:
      'Omega-3 đã vượt mức khuyến nghị — mức này thường an toàn, chỉ cần chú ý nếu dùng viên dầu cá liều cao.',
    sourceUrl: 'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/',
  },
  sodium: {
    id: 'sodium',
    overThreshold: 1.0,
    overAdviceVi:
      'Natri đã vượt ngưỡng gợi ý — thử giảm nước mắm, muối chấm, đồ hộp hoặc mì gói.',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/sodium-reduction',
  },
  sugar: {
    id: 'sugar',
    overThreshold: 1.0,
    overAdviceVi: 'Đường đã vượt ngưỡng gợi ý — thử giảm nước ngọt, bánh kẹo hoặc trà sữa.',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/sugars-and-dental-caries',
  },
  salt: {
    // Derived from sodium (salt g = sodium mg × 2.5 / 1000) — see
    // per100gValue('salt') in microBatteryEngine.ts.
    id: 'salt',
    overThreshold: 1.0,
    overAdviceVi: 'Muối đã vượt ngưỡng gợi ý — thử giảm nước mắm, muối chấm, đồ hộp hoặc mì gói.',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction',
  },
};

// Fixed display order for rows/sheets that enumerate every rule.
export const ASSESSMENT_ORDER: MicronutrientId[] = [
  'fiber',
  'iron',
  'calcium',
  'fat',
  'potassium',
  'magnesium',
  'zinc',
  'omega3',
  'sodium',
  'sugar',
  'salt',
];

export const DISCLAIMER_VI = 'Chỉ để tham khảo — không phải tư vấn y tế.';

// Single-nutrient assessment line, or null when nothing worth flagging
// (target <= 0, or the value sits comfortably between the two thresholds).
export function assessState(state: MicroBatteryState): string | null {
  const rule = ASSESSMENT_RULES[state.id];
  if (!rule || state.target <= 0) return null;

  const ratio = state.current / state.target;

  if (rule.overThreshold !== undefined && ratio > rule.overThreshold && rule.overAdviceVi) {
    return rule.overAdviceVi;
  }
  if (rule.underThreshold !== undefined && ratio < rule.underThreshold && rule.underAdviceVi) {
    return rule.underAdviceVi;
  }
  return null;
}

// Joined Vietnamese assessment for one day's (or one week-average's) set of
// micro-battery states. Empty/all-fine → "Ổn 👍" rather than an empty cell.
export function assessDay(states: MicroBatteryState[]): string {
  const lines = states.map(assessState).filter((l): l is string => l !== null);
  return lines.length === 0 ? 'Ổn 👍' : lines.join(' ');
}
