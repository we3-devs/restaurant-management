import { z } from "zod"

export const GRN_STATUSES = ["draft", "received", "cancelled"] as const

export const createGoodsReceivingItemSchema = z.object({
  purchaseOrderItemId: z.number().positive(),
  ingredientId: z.number().positive(),
  quantityReceived: z.number().positive("Received quantity must be greater than 0"),
  unitCost: z.number().min(0).optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
})

export const createGoodsReceivingSchema = z.object({
  purchaseOrderId: z.number({ message: "Select a purchase order" }).positive(),
  supplierId: z.number().positive(),
  outletId: z.number().positive(),
  warehouseId: z.number().positive(),
  receivedDate: z.string().min(1, "Pick a received date"),
  notes: z.string().optional(),
  items: z.array(createGoodsReceivingItemSchema).min(1, "Receive at least one item"),
})

export type CreateGoodsReceivingInput = z.infer<typeof createGoodsReceivingSchema>
