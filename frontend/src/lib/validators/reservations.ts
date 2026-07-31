import { z } from "zod"

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const
export const RESERVATION_SOURCES = ["walk_in", "phone", "online", "staff", "other"] as const
export const RESERVATION_DEPOSIT_STATUSES = [
  "not_required",
  "pending",
  "paid",
  "refunded",
  "forfeited",
] as const

export const createReservationSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  customerId: z.number({ message: "Select a customer" }).positive(),
  reservedAt: z.string().min(1, "Pick a date/time"),
  guestCount: z.number().min(1),
  source: z.enum(RESERVATION_SOURCES),
  specialRequest: z.string().optional(),
  internalNote: z.string().optional(),
  depositAmount: z.number().min(0).optional(),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>

export const updateReservationSchema = z.object({
  reservedAt: z.string().min(1).optional(),
  guestCount: z.number().min(1).optional(),
  source: z.enum(RESERVATION_SOURCES).optional(),
  specialRequest: z.string().optional(),
  internalNote: z.string().optional(),
  depositAmount: z.number().min(0).optional(),
  depositStatus: z.enum(RESERVATION_DEPOSIT_STATUSES).optional(),
})

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>

export const assignReservationTableSchema = z.object({
  diningTableId: z.number({ message: "Select a table" }).positive(),
})

export type AssignReservationTableInput = z.infer<typeof assignReservationTableSchema>
