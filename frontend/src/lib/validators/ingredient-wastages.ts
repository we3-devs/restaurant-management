import { z } from "zod"

const wastageReasons = ["expired", "damaged", "spoiled", "over_preparation", "staff_error", "other"] as const

export const createIngredientWastageSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  wastageDate: z.string().min(1, "Date is required"),
  reason: z.enum(wastageReasons),
})

export type CreateIngredientWastageInput = z.infer<typeof createIngredientWastageSchema>

export const createIngredientWastageItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
})

export type CreateIngredientWastageItemInput = z.infer<typeof createIngredientWastageItemSchema>
