import { z } from "zod"

export const createTableSessionSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  diningTableId: z.number({ message: "Select a table" }).positive(),
  guestCount: z.number().min(1),
  customerId: z.number().positive().optional(),
  reservationId: z.number().positive().optional(),
})

export type CreateTableSessionInput = z.infer<typeof createTableSessionSchema>

// POST /table-sessions/open — opens the session and creates its first order
// atomically in one request (see OrdersService#openTableWithOrder). Mirrors
// createTableSessionSchema plus the order fields createOrderSchema needs.
export const openTableSessionSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  diningTableId: z.number({ message: "Select a table" }).positive(),
  guestCount: z.number().min(1),
  customerId: z.number().positive().optional(),
  reservationId: z.number().positive().optional(),
  orderType: z.string().optional(),
  note: z.string().optional(),
})

export type OpenTableSessionInput = z.infer<typeof openTableSessionSchema>

export const transferTableSessionSchema = z.object({
  newDiningTableId: z.number({ message: "Select a table" }).positive(),
})

export type TransferTableSessionInput = z.infer<typeof transferTableSessionSchema>
