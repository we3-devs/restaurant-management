import { z } from "zod"

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "partially_received",
  "received",
  "completed",
  "cancelled",
] as const

export const createPurchaseOrderItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
})

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number({ message: "Select a supplier" }).positive(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  warehouseId: z.number({ message: "Select a warehouse" }).positive(),
  expectedDeliveryDate: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  items: z.array(createPurchaseOrderItemSchema).optional(),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = z.object({
  expectedDeliveryDate: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
})

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export const addPurchaseOrderItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  quantity: z.number().min(0.0001, "Quantity must be greater than 0"),
  unit: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
})

export type AddPurchaseOrderItemInput = z.infer<typeof addPurchaseOrderItemSchema>

export const updatePurchaseOrderItemSchema = z.object({
  quantity: z.number().min(0.0001).optional(),
  unit: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
})

export type UpdatePurchaseOrderItemInput = z.infer<typeof updatePurchaseOrderItemSchema>
