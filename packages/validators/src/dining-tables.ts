import { z } from "zod"

export const DINING_TABLE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "inactive",
] as const

export const createDiningTableSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  diningAreaId: z.number({ message: "Select a dining area" }).positive(),
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  capacity: z.number().min(1),
})

export type CreateDiningTableInput = z.infer<typeof createDiningTableSchema>

export const updateDiningTableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  capacity: z.number().min(1),
  status: z.enum(DINING_TABLE_STATUSES),
  isActive: z.boolean(),
})

export type UpdateDiningTableInput = z.infer<typeof updateDiningTableSchema>
