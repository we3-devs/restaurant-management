import { z } from "zod"

const stockOutPurposes = ["production_use", "kitchen_use", "sample", "distribution", "other", "transfer"] as const

export const createStockOutSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  stockOutDate: z.string().min(1, "Date is required"),
  purpose: z.enum(stockOutPurposes),
})

export type CreateStockOutInput = z.infer<typeof createStockOutSchema>

export const createStockOutItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
})

export type CreateStockOutItemInput = z.infer<typeof createStockOutItemSchema>
