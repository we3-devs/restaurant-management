import { z } from "zod"

export const createFoodVariantSchema = z.object({
  foodId: z.number({ message: "Select a food" }).positive(),
  /** Nest under a top-level variant to build e.g. Momo -> Veg -> Half/Full. */
  parentId: z.number().positive().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  /** This level's SKU piece, e.g. CHI or FULL — joined onto the food's segment. */
  skuSegment: z.string().max(32).optional(),
  price: z.number().min(0),
  isDefault: z.boolean(),
})

export type CreateFoodVariantInput = z.infer<typeof createFoodVariantSchema>

export const updateFoodVariantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  skuSegment: z.string().max(32).optional(),
  /** Re-parent an existing variant, e.g. nesting Half under Veg after the fact. */
  parentId: z.number().positive().nullable().optional(),
  price: z.number().min(0),
  isDefault: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateFoodVariantInput = z.infer<typeof updateFoodVariantSchema>

export const upsertFoodVariantOutletSchema = z.object({
  outletId: z.number().positive(),
  price: z.number().min(0).optional(),
  isAvailable: z.boolean(),
})

export type UpsertFoodVariantOutletInput = z.infer<typeof upsertFoodVariantOutletSchema>
