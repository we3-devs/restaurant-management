import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
})

export type CreateOutletInput = z.infer<typeof createOutletSchema>

export const updateOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
})

export type UpdateOutletInput = z.infer<typeof updateOutletSchema>
