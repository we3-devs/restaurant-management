import { z } from "zod"

export const ingredientTypes = ["raw_material", "ready_product", "packaging", "consumable", "beverage"] as const

export const createIngredientCategorySchema = z.object({
  parentId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(1, "Slug is required"),
  code: z.string().optional(),
  type: z.enum(ingredientTypes),
})

export type CreateIngredientCategoryInput = z.infer<typeof createIngredientCategorySchema>

export const updateIngredientCategorySchema = z.object({
  parentId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().optional(),
  type: z.enum(ingredientTypes),
  isActive: z.boolean(),
})

export type UpdateIngredientCategoryInput = z.infer<typeof updateIngredientCategorySchema>
