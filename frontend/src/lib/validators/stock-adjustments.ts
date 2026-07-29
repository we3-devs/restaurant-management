import { z } from "zod"

export const createStockAdjustmentSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  adjustmentDate: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
})

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>

export const createStockAdjustmentItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  actualQuantity: z.number().min(0, "Quantity cannot be negative"),
})

export type CreateStockAdjustmentItemInput = z.infer<typeof createStockAdjustmentItemSchema>
