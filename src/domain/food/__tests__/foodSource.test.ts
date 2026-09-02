import { foodSourceKind } from '../foodSource';

describe('foodSourceKind', () => {
  it('classifies a user-created food as mine, by source or by id prefix', () => {
    expect(foodSourceKind({ id: 'custom_123_ab', source: 'custom' })).toBe('mine');
    expect(foodSourceKind({ id: 'custom_123_ab', source: 'label' })).toBe('mine');
    expect(foodSourceKind({ id: 'yakult_home', source: 'custom' })).toBe('mine');
  });

  it('classifies the bulk USDA import by its id prefix', () => {
    expect(foodSourceKind({ id: 'usda_2727589', source: 'usda' })).toBe('usda');
  });

  it('falls back to the curated starter catalog', () => {
    expect(foodSourceKind({ id: 'rice_white_cooked', source: 'label' })).toBe('catalog');
  });
});
