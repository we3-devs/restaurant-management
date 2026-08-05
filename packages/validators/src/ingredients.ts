import { z } from "zod"

const ingredientTypes = ["raw_material", "ready_product", "packaging", "consumable"] as const

export const createIngredientSchema = z.object({
  ingredientCategoryId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(1, "Slug is required"),
  code: z.string().min(1, "Code is required"),
  type: z.enum(ingredientTypes),
  baseUnitId: z.number({ message: "Select a base unit" }).positive(),
})

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>

export const updateIngredientSchema = z.object({
  ingredientCategoryId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(1, "Code is required"),
  type: z.enum(ingredientTypes),
  isActive: z.boolean(),
})

export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>
