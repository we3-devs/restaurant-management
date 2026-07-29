import { z } from "zod"

export const createAddonGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  isRequired: z.boolean(),
  minSelect: z.number().min(0),
  maxSelect: z.number().min(1).optional(),
})

export type CreateAddonGroupInput = z.infer<typeof createAddonGroupSchema>

export const updateAddonGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  isRequired: z.boolean(),
  minSelect: z.number().min(0),
  maxSelect: z.number().min(1).optional(),
  isActive: z.boolean(),
})

export type UpdateAddonGroupInput = z.infer<typeof updateAddonGroupSchema>
