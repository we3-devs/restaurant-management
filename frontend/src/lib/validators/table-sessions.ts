import { z } from "zod"

export const createTableSessionSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  diningTableId: z.number({ message: "Select a table" }).positive(),
  guestCount: z.number().min(1),
  customerId: z.number().positive().optional(),
  reservationId: z.number().positive().optional(),
})

export type CreateTableSessionInput = z.infer<typeof createTableSessionSchema>

export const transferTableSessionSchema = z.object({
  newDiningTableId: z.number({ message: "Select a table" }).positive(),
})

export type TransferTableSessionInput = z.infer<typeof transferTableSessionSchema>
