import { z } from "zod"

export const createTableSessionSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  diningTableId: z.number({ message: "Select a table" }).positive(),
  guestCount: z.number().min(1),
})

export type CreateTableSessionInput = z.infer<typeof createTableSessionSchema>
