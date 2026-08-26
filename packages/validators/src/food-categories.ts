import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createFoodCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase, alphanumeric, hyphen-separated"),
  parentId: z.number().optional(),
  description: z.string().optional(),
})

export type CreateFoodCategoryInput = z.infer<typeof createFoodCategorySchema>

export const updateFoodCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  parentId: z.number().nullable().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
})

export type UpdateFoodCategoryInput = z.infer<typeof updateFoodCategorySchema>
