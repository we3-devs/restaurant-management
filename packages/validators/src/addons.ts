import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createAddonSchema = z.object({
  addonGroupId: z.number().optional(),
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  price: z.number().min(0),
})

export type CreateAddonInput = z.infer<typeof createAddonSchema>

export const updateAddonSchema = z.object({
  addonGroupId: z.number().nullable().optional(),
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  price: z.number().min(0),
  isRecipeEnabled: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateAddonInput = z.infer<typeof updateAddonSchema>
