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
  unitId: z.number().positive().optional(),
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
})

export type CreateStockInItemInput = z.infer<typeof createStockInItemSchema>

/**
 * "Add inventory item" on Manage Inventory Items — brings an existing
 * ingredient into a warehouse with an opening balance. Posted as a one-item
 * stock-in, so the fields mirror createStockIn + createStockInItem rather
 * than describing a record of their own.
 */
export const createInventoryItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive("Select an ingredient"),
  warehouseId: z.number({ message: "Select a warehouse" }).positive("Select a warehouse"),
  quantity: z.number().positive("Opening quantity must be greater than 0"),
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
})

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
