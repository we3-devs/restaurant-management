import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createIngredientSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  ingredientCategoryId: z.number().positive("Category is required"),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  slug: z.string().min(1, "Slug is required"),
  code: z.string().min(1, "Code is required"),
  buyingPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  baseUnitId: z.number({ message: "Select a base unit" }).positive(),
})

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>

export const updateIngredientSchema = z.object({
  ingredientCategoryId: z.number().positive("Category is required"),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  code: z.string().min(1, "Code is required"),
  buyingPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  isActive: z.boolean(),
})

export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>
