import { z } from "zod"

export const createFoodVariantSchema = z.object({
  foodId: z.number({ message: "Select a food" }).positive(),
  /** Value from the global variant list, e.g. Chicken. Null for a plain item. */
  variantId: z.number().positive().nullable().optional(),
  /** Value from the global sub-variant list, e.g. Full. Null if unsized. */
  subVariantId: z.number().positive().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0),
  isDefault: z.boolean(),
})

export type CreateFoodVariantInput = z.infer<typeof createFoodVariantSchema>

export const updateFoodVariantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  variantId: z.number().positive().nullable().optional(),
  subVariantId: z.number().positive().nullable().optional(),
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
