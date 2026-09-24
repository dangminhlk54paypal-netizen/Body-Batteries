import { create } from 'zustand';
import type { LiftingSet, UserProfile } from '../types/energy';
import type { GeneratedBlockPlan, NewTrainingBlockConfig } from '../types/powerliftingBlock';
import { refreshSuggestions, setVariationSets, setWeekDates } from '../domain/energy/blockPlanEdits';
import type { VariationAddress, WeekDatesError } from '../domain/energy/blockPlanEdits';
import { generateBlockPlan } from '../domain/energy/blockEngine';
import {
  addTrainingBlock,
  getActiveTrainingBlock,
  getTrainingBlockById,
  listTrainingBlocks,
  updateTrainingBlock,
  deleteTrainingBlock,
} from '../data/repositories/trainingBlockRepository';

// Thin CRUD store for the S-PL Block Builder (docs/08-powerlifting-engine.md).
// No `persist` middleware — SQLite (via trainingBlockRepository) is the
// source of truth, same convention as energyStore. All plan-GENERATION logic
// lives in blockEngine.ts (pure); this store only orchestrates load/save.
interface BlockState {
  activeBlock: GeneratedBlockPlan | null;
  blocks: GeneratedBlockPlan[];
  loading: boolean;
  loadActiveBlock: () => Promise<void>;
  loadAllBlocks: () => Promise<void>;
  createBlock: (config: NewTrainingBlockConfig, profile: UserProfile) => Promise<GeneratedBlockPlan>;
  deleteBlock: (id: string) => Promise<void>;
  // Sets the block's display title for the training log (blank clears it, so
  // the log falls back to "Block <n>"). Works on any stored block, active or
  // not — the log lists every block, not just the active one.
  renameBlock: (id: string, name: string) => Promise<void>;
  // The user's own plan for one variation-week of the ACTIVE block (`sets` =
  // null restores the app's suggestion). Needs the lifter's height for kcal.
  editVariationSets: (at: VariationAddress, sets: LiftingSet[] | null, heightCm: number) => Promise<void>;
  // Real dates for one week of the active block; later weeks follow. Returns
  // the validation error instead of saving when the dates don't fit.
  editWeekDates: (weekIndex: number, start: string, end: string) => Promise<WeekDatesError | null>;
  // Recalculate the active block's suggestions with the current engine,
  // keeping the user's own sets and every week's dates.
  refreshActiveSuggestions: (profile: UserProfile) => Promise<void>;
}

export const useBlockStore = create<BlockState>((set, get) => {
  // Persists an edited version of the active block and mirrors it into state.
  async function saveActive(plan: GeneratedBlockPlan) {
    await updateTrainingBlock(plan);
    set((s) => ({
      activeBlock: plan,
      blocks: s.blocks.map((b) => (b.config.id === plan.config.id ? plan : b)),
    }));
  }

  return {
  activeBlock: null,
  blocks: [],
  loading: false,

  loadActiveBlock: async () => {
    set({ loading: true });
    const activeBlock = await getActiveTrainingBlock();
    set({ activeBlock, loading: false });
  },

  loadAllBlocks: async () => {
    set({ loading: true });
    const blocks = await listTrainingBlocks();
    set({ blocks, loading: false });
  },

  // Stamps id/createdAt (store action, not component render — see
  // NewTrainingBlockConfig's doc comment), generates the full week-by-week
  // plan (blockEngine), and persists it as the new active block —
  // addTrainingBlock() deactivates any previous one.
  createBlock: async (config, profile) => {
    const fullConfig = { ...config, id: `block_${Date.now()}`, createdAt: Date.now() };
    const plan = generateBlockPlan(fullConfig, profile);
    await addTrainingBlock(plan);
    set({ activeBlock: plan });
    return plan;
  },

  deleteBlock: async (id) => {
    await deleteTrainingBlock(id);
    const wasActive = get().activeBlock?.config.id === id;
    set((s) => ({
      blocks: s.blocks.filter((b) => b.config.id !== id),
      activeBlock: wasActive ? null : s.activeBlock,
    }));
  },

  renameBlock: async (id, name) => {
    const plan = await getTrainingBlockById(id);
    if (!plan) return;
    const trimmed = name.trim();
    const updated = { ...plan, config: { ...plan.config, name: trimmed === '' ? undefined : trimmed } };
    await updateTrainingBlock(updated);
    set((s) => ({
      activeBlock: s.activeBlock?.config.id === id ? updated : s.activeBlock,
      blocks: s.blocks.map((b) => (b.config.id === id ? updated : b)),
    }));
  },

  editVariationSets: async (at, sets, heightCm) => {
    const block = get().activeBlock;
    if (!block) return;
    await saveActive(setVariationSets(block, at, sets, heightCm));
  },

  editWeekDates: async (weekIndex, start, end) => {
    const block = get().activeBlock;
    if (!block) return null;
    const result = setWeekDates(block, weekIndex, start, end);
    if (!result.ok) return result.error;
    await saveActive(result.plan);
    return null;
  },

  refreshActiveSuggestions: async (profile) => {
    const block = get().activeBlock;
    if (!block) return;
    await saveActive(refreshSuggestions(block, profile));
  },
};
});
