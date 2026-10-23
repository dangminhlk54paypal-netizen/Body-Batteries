import type { FoodItem } from '../../types/food';

// Where a search result came from. The app deliberately ships a starter
// catalog rather than THE catalog — a user's own entries are the point, so
// the list has to say which is which instead of blending them into one
// anonymous pile.
//
// 'mine'    — a food this user created (custom_foods)
// 'catalog' — the curated Vietnamese starter list (food_items.csv)
// 'usda'    — the bulk USDA import, useful but generic
// 'library' — a row of a table the user imported ("Nguồn của tôi",
//             domain/food/library/libraryMapping.ts), id prefix `lib_`
export type FoodSourceKind = 'mine' | 'catalog' | 'usda' | 'library';

// Custom foods are written by buildCustomFoodItem with source 'custom' and a
// `custom_` id prefix; either marker alone is enough, and checking both keeps
// a food imported from a backup (which may carry an older source string)
// classified correctly.
export function foodSourceKind(item: Pick<FoodItem, 'id' | 'source'>): FoodSourceKind {
  if (item.source === 'custom' || item.id.startsWith('custom_')) return 'mine';
  if (item.id.startsWith('usda_')) return 'usda';
  if (item.id.startsWith('lib_')) return 'library';
  return 'catalog';
}
