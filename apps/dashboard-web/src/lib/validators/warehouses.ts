import { z } from "zod"

export const createWarehouseSchema = z.object({
  outletId: z.number({ message: "Select an outlet" }).positive(),
  outletDepartmentId: z.number().positive().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(1, "Code is required"),
  isDefault: z.boolean(),
})

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>

export const updateWarehouseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(1, "Code is required"),
  address: z.string().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>
