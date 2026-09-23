import { z } from "zod"
import { toTitleCase } from "./helpers"

export const ingredientTypes = ["raw_material", "ready_product", "packaging", "consumable", "beverage"] as const

/**
 * Types that carry warehouse stock. Mirrors the backend's
 * TRACKED_INGREDIENT_TYPES — every stock document asserts this server-side
 * (IngredientsService#assertTrackable), so a UI that offers an untracked
 * ingredient is only setting the user up for a rejected request.
 *
 * raw_material and ready_product are deliberately excluded: they're consumed
 * through recipes rather than counted in a warehouse.
 */
export const trackedIngredientTypes = ["beverage", "packaging", "consumable"] as const satisfies readonly (typeof ingredientTypes)[number][]

export function isTrackedIngredientType(type: string): boolean {
  return (trackedIngredientTypes as readonly string[]).includes(type)
}

export const createIngredientCategorySchema = z.object({
  parentId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  slug: z.string().min(1, "Slug is required"),
  code: z.string().optional(),
  type: z.enum(ingredientTypes),
})

export type CreateIngredientCategoryInput = z.infer<typeof createIngredientCategorySchema>

export const updateIngredientCategorySchema = z.object({
  parentId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  code: z.string().optional(),
  type: z.enum(ingredientTypes),
  isActive: z.boolean(),
})

export type UpdateIngredientCategoryInput = z.infer<typeof updateIngredientCategorySchema>
