import { create } from 'zustand';
import type { UserProfile } from '../types/energy';
import type { GeneratedBlockPlan, NewTrainingBlockConfig } from '../types/powerliftingBlock';
import { generateBlockPlan } from '../domain/energy/blockEngine';
import {
  addTrainingBlock,
  getActiveTrainingBlock,
  listTrainingBlocks,
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
}

export const useBlockStore = create<BlockState>((set, get) => ({
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
}));
