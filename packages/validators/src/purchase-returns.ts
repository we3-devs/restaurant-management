import { z } from "zod"

export const PURCHASE_RETURN_STATUSES = ["draft", "processed", "cancelled"] as const
export const REFUND_TYPES = ["refund", "replacement", "both"] as const

export const createPurchaseReturnItemSchema = z.object({
  purchaseOrderItemId: z.number().positive().optional(),
  ingredientId: z.number().positive(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitCost: z.number().min(0).optional(),
})

export const createPurchaseReturnSchema = z.object({
  purchaseOrderId: z.number().positive().optional(),
  supplierId: z.number().positive(),
  outletId: z.number().positive(),
  warehouseId: z.number().positive(),
  returnDate: z.string().min(1, "Pick a return date"),
  reason: z.string().optional(),
  refundType: z.enum(REFUND_TYPES).optional(),
  items: z.array(createPurchaseReturnItemSchema).min(1, "Return at least one item"),
})

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>
