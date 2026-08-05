import { z } from "zod"

const stockInSources = ["purchase", "return", "correction", "donation", "other", "transfer"] as const

export const createStockInSchema = z.object({
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  stockInDate: z.string().min(1, "Date is required"),
  source: z.enum(stockInSources),
})

export type CreateStockInInput = z.infer<typeof createStockInSchema>

export const createStockInItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
})

export type CreateStockInItemInput = z.infer<typeof createStockInItemSchema>
