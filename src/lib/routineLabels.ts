import type { RoutineMetric } from '../domain/routine/routineEngine';
import { LOCALE_TAGS } from '../i18n/types';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function routineAmount(metric: RoutineMetric, value: number, t: TFn, language: Language): string {
  return `${value.toLocaleString(LOCALE_TAGS[language])} ${t(`components.routine.unit.${metric}`)}`;
}
