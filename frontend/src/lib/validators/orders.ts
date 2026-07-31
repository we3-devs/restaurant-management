import { z } from "zod"

export const ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const
export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "partially_ready",
  "ready",
  "partially_served",
  "served",
  "completed",
  "cancelled",
] as const
// Mirrors the backend's ORDER_STATUS_TRANSITIONS (orders.service.ts) — the
// source of truth for what's actually accepted lives server-side; this only
// drives which options the status dropdown offers.
export const ORDER_STATUS_TRANSITIONS: Record<(typeof ORDER_STATUSES)[number], (typeof ORDER_STATUSES)[number][]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["partially_ready", "ready", "cancelled"],
  partially_ready: ["ready", "partially_served", "cancelled"],
  ready: ["partially_served", "served", "cancelled"],
  partially_served: ["served", "cancelled"],
  served: ["completed"],
  completed: [],
  cancelled: [],
}

export const ORDER_ITEM_STATUSES = [
  "stock_reserved",
  "sent_to_kitchen",
  "preparing",
  "ready",
  "served",
  "cancelled",
] as const
export const ORDER_DISCOUNT_TYPES = ["flat", "percentage"] as const
export const ORDER_TABLE_ASSIGNMENT_TYPES = [
  "reserved_copy",
  "added_on_arrival",
  "changed_by_staff",
] as const
export const ORDER_PAYMENT_TYPES = ["payment", "refund"] as const
export const ORDER_PAYMENT_METHODS = ["cash", "card", "online", "credit", "other"] as const

export const createOrderSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  tableSessionId: z.number().positive().optional(),
  orderType: z.enum(ORDER_TYPES),
  note: z.string().optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderSchema = z.object({
  note: z.string().optional(),
  discountType: z.enum(ORDER_DISCOUNT_TYPES).optional(),
  discountValue: z.number().min(0),
  taxAmount: z.number().min(0),
  serviceChargeAmount: z.number().min(0),
})

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

export const createOrderItemSchema = z.object({
  foodId: z.number({ message: "Select a food" }).positive(),
  foodVariantId: z.number().positive().optional(),
  preparationDepartmentId: z.number().positive().optional(),
  quantity: z.number().min(0.01),
})

export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>

export const createOrderItemAddonSchema = z.object({
  addonId: z.number({ message: "Select an addon" }).positive(),
  quantity: z.number().min(0.01),
})

export type CreateOrderItemAddonInput = z.infer<typeof createOrderItemAddonSchema>

export const assignOrderTableSchema = z.object({
  diningTableId: z.number({ message: "Select a table" }).positive(),
})

export type AssignOrderTableInput = z.infer<typeof assignOrderTableSchema>

export const createOrderPaymentSchema = z.object({
  type: z.enum(ORDER_PAYMENT_TYPES),
  method: z.enum(ORDER_PAYMENT_METHODS),
  amount: z.number().min(0.01),
  note: z.string().optional(),
})

export type CreateOrderPaymentInput = z.infer<typeof createOrderPaymentSchema>
