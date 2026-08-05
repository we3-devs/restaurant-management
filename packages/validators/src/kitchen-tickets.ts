import { z } from "zod"

export const KITCHEN_TICKET_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const
export const KITCHEN_TICKET_ITEM_STATUSES = [
  "sent_to_kitchen",
  "preparing",
  "ready",
  "served",
  "cancelled",
] as const
export const KITCHEN_TICKET_PRIORITIES = ["normal", "high", "urgent"] as const

// Mirrors the backend's ITEM_STATUS_TRANSITIONS (kitchen-tickets.service.ts)
// — the source of truth lives server-side; this only drives which "next
// status" action the KDS board offers per item.
export const KITCHEN_TICKET_ITEM_STATUS_TRANSITIONS: Record<
  (typeof KITCHEN_TICKET_ITEM_STATUSES)[number],
  (typeof KITCHEN_TICKET_ITEM_STATUSES)[number][]
> = {
  sent_to_kitchen: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
}

export const updateKitchenTicketItemStatusSchema = z.object({
  status: z.enum(KITCHEN_TICKET_ITEM_STATUSES),
})

export type UpdateKitchenTicketItemStatusInput = z.infer<typeof updateKitchenTicketItemStatusSchema>

export const updateKitchenTicketPrioritySchema = z.object({
  priority: z.enum(KITCHEN_TICKET_PRIORITIES),
})

export type UpdateKitchenTicketPriorityInput = z.infer<typeof updateKitchenTicketPrioritySchema>
