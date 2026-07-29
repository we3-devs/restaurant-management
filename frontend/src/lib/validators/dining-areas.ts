import { z } from "zod"

export const createDiningAreaSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().optional(),
})

export type CreateDiningAreaInput = z.infer<typeof createDiningAreaSchema>

export const updateDiningAreaSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().optional(),
  isActive: z.boolean(),
})

export type UpdateDiningAreaInput = z.infer<typeof updateDiningAreaSchema>
