import { z } from "zod"

export const createInventoryKitSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
})

export type CreateInventoryKitInput = z.infer<typeof createInventoryKitSchema>

export const updateInventoryKitSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  isActive: z.boolean(),
})

export type UpdateInventoryKitInput = z.infer<typeof updateInventoryKitSchema>

export const createKitItemSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  label: z.string().min(1, "Label is required").max(100),
  unitId: z.number({ message: "Select a unit" }).positive(),
})

export type CreateKitItemInput = z.infer<typeof createKitItemSchema>

export const createKitPortionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  unitId: z.number({ message: "Select a unit" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
})

export type CreateKitPortionInput = z.infer<typeof createKitPortionSchema>
