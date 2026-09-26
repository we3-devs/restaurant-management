import { z } from "zod"

export const createIngredientVariantSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  label: z.string().min(1, "Label is required").max(100),
  unitId: z.number({ message: "Select a unit" }).positive(),
  unitsPerPackage: z.number().int().positive().optional(),
  packageLabel: z.string().max(50).optional(),
})

export type CreateIngredientVariantInput = z.infer<typeof createIngredientVariantSchema>

export const createIngredientVariantPortionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  unitId: z.number({ message: "Select a unit" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
})

export type CreateIngredientVariantPortionInput = z.infer<typeof createIngredientVariantPortionSchema>

export const receiveVariantsStockSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  stockInDate: z.string().min(1, "Date is required"),
  remarks: z.string().optional(),
  lines: z
    .array(
      z.object({
        variantId: z.number().positive(),
        packages: z.number().positive("Quantity must be positive"),
        unitCost: z.number().min(0).optional(),
      }),
    )
    .min(1, "Add at least one variant"),
})

export type ReceiveVariantsStockInput = z.infer<typeof receiveVariantsStockSchema>
