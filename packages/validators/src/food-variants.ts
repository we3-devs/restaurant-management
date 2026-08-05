import { z } from "zod"

export const createFoodVariantSchema = z.object({
  foodId: z.number({ message: "Select a food" }).positive(),
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  price: z.number().min(0),
  isDefault: z.boolean(),
})

export type CreateFoodVariantInput = z.infer<typeof createFoodVariantSchema>

export const updateFoodVariantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
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
