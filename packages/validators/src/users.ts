import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

/** Same as createUserSchema plus an optional role to assign right after creation — kept separate since roleId isn't part of the POST /users payload itself (it's a second API call). */
export const createUserWithRoleSchema = createUserSchema.extend({
  roleId: z.number().positive().optional(),
})

export type CreateUserWithRoleInput = z.infer<typeof createUserWithRoleSchema>

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  email: z.string().email("Enter a valid email address"),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
