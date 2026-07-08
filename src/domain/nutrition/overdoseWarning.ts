import { UPPER_LIMITS } from '../../lib/upperLimits';
import type { MicroBatteryState } from '../../types/nutrition';

// Pure overdose-warning engine (no I/O) — flags micronutrients whose today
// total has crossed their Tolerable Upper Intake Level (see
// lib/upperLimits.ts). Deliberately gentle, referential wording only (see
// .ai/CONTEXT.md §5): never diagnostic, never "nguy hiểm"/medical-claim
// language.
export interface OverdoseWarning {
  id: MicroBatteryState['id'];
  nameVi: string;
  current: number;
  limit: number;
  unit: 'g' | 'mg';
  messageVi: string;
}

function buildMessage(nameVi: string, current: number, limit: number, unit: string): string {
  return (
    `${nameVi}: đã nạp ${current}${unit}, vượt mức dung nạp tối đa tham khảo (${limit}${unit}). ` +
    `Nếu bạn đang dùng nhiều thực phẩm chức năng cùng loại, cân nhắc giảm bớt. ` +
    `Chỉ để tham khảo, không thay lời khuyên y tế.`
  );
}

export function computeOverdoseWarnings(micros: MicroBatteryState[]): OverdoseWarning[] {
  const warnings: OverdoseWarning[] = [];

  for (const micro of micros) {
    const ul = UPPER_LIMITS[micro.id];
    if (!ul) continue; // no defined upper limit for this nutrient — never fires
    if (micro.current <= ul.value) continue;

    warnings.push({
      id: micro.id,
      nameVi: ul.nameVi,
      current: micro.current,
      limit: ul.value,
      unit: ul.unit,
      messageVi: buildMessage(ul.nameVi, micro.current, ul.value, ul.unit),
    });
  }

  return warnings;
}
