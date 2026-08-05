import { z } from "zod"

export const createStockCountSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  countDate: z.string().min(1, "Date is required"),
})

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>

export const createStockCountItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  countedQuantity: z.number().min(0, "Quantity cannot be negative"),
})

export type CreateStockCountItemInput = z.infer<typeof createStockCountItemSchema>
