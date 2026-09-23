import { useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { resolveTrainingLogFormat } from '../types/trainingLog';
import type { TrainingLogFormat } from '../types/trainingLog';

// The training log's effective format: persisted settings merged over the
// defaults (a device that saved before an option existed still gets it).
// Memoised on the stored object so consumers keep a stable reference between
// unrelated renders.
export function useTrainingLogFormat(): TrainingLogFormat {
  const stored = useSettingsStore((s) => s.trainingLogFormat);
  return useMemo(() => resolveTrainingLogFormat(stored), [stored]);
}
