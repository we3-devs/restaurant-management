import { z } from "zod"
import { toTitleCase } from "./helpers"

export const portalOptions = ["dashboard", "staff", "both"] as const

export const createRoleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase, alphanumeric, hyphen-separated"),
  description: z.string().optional(),
  portal: z.enum(portalOptions),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>

export const updateRoleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  description: z.string().optional(),
  isAssignable: z.boolean(),
  isActive: z.boolean(),
  portal: z.enum(portalOptions),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
