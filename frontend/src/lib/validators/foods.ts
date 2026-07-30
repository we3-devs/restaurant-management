import { z } from "zod"

export const FOOD_TYPES = ["veg", "non_veg", "egg", "vegan"] as const
export const FOOD_ITEM_TYPES = ["food", "beverage", "combo"] as const

export const createFoodSchema = z.object({
  foodCategoryId: z.number().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase, alphanumeric, hyphen-separated"),
  sku: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  itemType: z.enum(FOOD_ITEM_TYPES),
  basePrice: z.number().min(0),
})

export type CreateFoodInput = z.infer<typeof createFoodSchema>

export const updateFoodSchema = z.object({
  foodCategoryId: z.number().nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  itemType: z.enum(FOOD_ITEM_TYPES),
  basePrice: z.number().min(0),
  isTaxable: z.boolean(),
  isDiscountable: z.boolean(),
  isFeatured: z.boolean(),
  isRecipeEnabled: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateFoodInput = z.infer<typeof updateFoodSchema>

export const upsertFoodOutletSchema = z.object({
  outletId: z.number().positive(),
  price: z.number().min(0).optional(),
  isAvailable: z.boolean(),
})

export type UpsertFoodOutletInput = z.infer<typeof upsertFoodOutletSchema>
