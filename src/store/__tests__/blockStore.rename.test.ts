import { useBlockStore } from '../blockStore';
import * as trainingBlockRepository from '../../data/repositories/trainingBlockRepository';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('../../data/repositories/trainingBlockRepository');

const repo = jest.mocked(trainingBlockRepository);

const plan = (id: string, name?: string): GeneratedBlockPlan =>
  ({ config: { id, createdAt: 1, focus: 'volume', name }, weeks: [] }) as unknown as GeneratedBlockPlan;

beforeEach(() => {
  jest.resetAllMocks();
  repo.updateTrainingBlock.mockResolvedValue(undefined);
  useBlockStore.setState({ activeBlock: null, blocks: [] });
});

describe('blockStore.renameBlock', () => {
  it('stores the trimmed name on a stored block and mirrors it into state', async () => {
    const p = plan('b1');
    repo.getTrainingBlockById.mockResolvedValue(p);
    useBlockStore.setState({ activeBlock: p, blocks: [p] });

    await useBlockStore.getState().renameBlock('b1', '  Block2 Accumulation ');

    expect(repo.updateTrainingBlock).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ id: 'b1', name: 'Block2 Accumulation' }) })
    );
    expect(useBlockStore.getState().activeBlock?.config.name).toBe('Block2 Accumulation');
    expect(useBlockStore.getState().blocks[0].config.name).toBe('Block2 Accumulation');
  });

  it('a blank name clears it (the log falls back to "Block <n>")', async () => {
    repo.getTrainingBlockById.mockResolvedValue(plan('b1', 'Old'));
    await useBlockStore.getState().renameBlock('b1', '   ');
    expect(repo.updateTrainingBlock).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ name: undefined }) })
    );
  });

  it('works on a block that is not the active one and leaves the active block alone', async () => {
    const active = plan('active');
    useBlockStore.setState({ activeBlock: active });
    repo.getTrainingBlockById.mockResolvedValue(plan('old'));
    await useBlockStore.getState().renameBlock('old', 'Block 1');
    expect(useBlockStore.getState().activeBlock).toBe(active);
    expect(repo.updateTrainingBlock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the block no longer exists', async () => {
    repo.getTrainingBlockById.mockResolvedValue(null);
    await useBlockStore.getState().renameBlock('gone', 'x');
    expect(repo.updateTrainingBlock).not.toHaveBeenCalled();
  });
});
