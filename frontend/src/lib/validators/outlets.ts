import { z } from "zod"

export const createOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
})

export type CreateOutletInput = z.infer<typeof createOutletSchema>

export const updateOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
})

export type UpdateOutletInput = z.infer<typeof updateOutletSchema>
