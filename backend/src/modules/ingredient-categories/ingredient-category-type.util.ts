export const INGREDIENT_TYPES = [
  'raw_material',
  'ready_product',
  'packaging',
  'consumable',
  'beverage',
] as const;

export type IngredientType = (typeof INGREDIENT_TYPES)[number];

export const TRACKED_INGREDIENT_TYPES = [
  'beverage',
  'packaging',
  'consumable',
] as const satisfies readonly IngredientType[];

export const UNTRACKED_INGREDIENT_TYPES = [
  'raw_material',
  'ready_product',
] as const satisfies readonly IngredientType[];

export function isTrackableIngredientType(type: string): boolean {
  return (TRACKED_INGREDIENT_TYPES as readonly string[]).includes(type);
}
