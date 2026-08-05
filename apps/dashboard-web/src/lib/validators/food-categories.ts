import { z } from "zod"

export const createFoodCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase, alphanumeric, hyphen-separated"),
  parentId: z.number().optional(),
  description: z.string().optional(),
})

export type CreateFoodCategoryInput = z.infer<typeof createFoodCategorySchema>

export const updateFoodCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  parentId: z.number().nullable().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
})

export type UpdateFoodCategoryInput = z.infer<typeof updateFoodCategorySchema>
