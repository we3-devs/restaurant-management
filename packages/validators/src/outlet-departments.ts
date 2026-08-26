import { z } from "zod"
import { toTitleCase } from "./helpers"

export const OUTLET_DEPARTMENT_TYPES = [
  "kitchen",
  "bar",
  "counter",
  "store",
  "bakery",
  "housekeeping",
  "other",
] as const

export const createOutletDepartmentSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  code: z.string().optional(),
  type: z.enum(OUTLET_DEPARTMENT_TYPES),
})

export type CreateOutletDepartmentInput = z.infer<typeof createOutletDepartmentSchema>

export const updateOutletDepartmentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  code: z.string().optional(),
  type: z.enum(OUTLET_DEPARTMENT_TYPES),
  description: z.string().optional(),
  canPrepareOrder: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateOutletDepartmentInput = z.infer<typeof updateOutletDepartmentSchema>
