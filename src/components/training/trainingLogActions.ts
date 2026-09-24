import type { TrainingLogPeriod } from '../../types/trainingLog';

// What the notebook's rows can ask the screen to do. The sections only report
// the tap; TrainingLogView owns every sheet (editor, note, rename), so a sheet
// is mounted once instead of once per week.
export interface TrainingLogActions {
  // Tap on a day's line: edit that day.
  editDay: (date: string) => void;
  // "＋ Ghi buổi": a hand-written entry, starting on `suggestedDate`.
  addDay: (suggestedDate: string) => void;
  // Edit a week's note. `label` is the week's heading without weight ("W4", "07.09–13.09").
  editWeekNote: (weekStart: string, label: string) => void;
  // Long-press on a period heading: a block offers rename / delete, a free
  // month goes straight to giving it its own name.
  periodMenu: (period: TrainingLogPeriod) => void;
  // ✎ at a period heading ("📄 Trang"): the whole period as one text block, to edit or share.
  openPage: (period: TrainingLogPeriod) => void;
}
