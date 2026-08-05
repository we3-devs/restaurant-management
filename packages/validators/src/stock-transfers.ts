import { z } from "zod"

export const createStockTransferSchema = z.object({
  fromWarehouseId: z.number({ message: "Select a source warehouse" }).positive(),
  toWarehouseId: z.number({ message: "Select a destination warehouse" }).positive(),
  transferDate: z.string().min(1, "Date is required"),
})

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>

export const createStockTransferItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
})

export type CreateStockTransferItemInput = z.infer<typeof createStockTransferItemSchema>
