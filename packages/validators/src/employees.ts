import { z } from "zod"
import { toTitleCase } from "./helpers"

export const EMPLOYMENT_STATUSES = ["active", "inactive", "terminated", "resigned"] as const

/** Fields that actually make up the POST /employees payload — loginMode/password (below) are form-only and get resolved into `userId` before the request goes out. */
const createEmployeeApiSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.number().positive().optional(),
  positionId: z.number().positive().optional(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  photoUrl: z.string().optional(),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  requiresAttendance: z.boolean().optional(),
  emergencyContactName: z.string().transform(toTitleCase).optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export type CreateEmployeeApiInput = z.infer<typeof createEmployeeApiSchema>

/** "new" creates a fresh login account inline (name/email/password) and links it; "existing" links an already-created account; "none" leaves the employee without a login. */
export const LOGIN_MODES = ["none", "new", "existing"] as const

export const createEmployeeSchema = createEmployeeApiSchema
  .extend({
    loginMode: z.enum(LOGIN_MODES),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.loginMode === "new") {
      if (!data.email) {
        ctx.addIssue({ path: ["email"], code: z.ZodIssueCode.custom, message: "Email is required to create a login" })
      }
      if (!data.password || data.password.length < 8) {
        ctx.addIssue({
          path: ["password"],
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters",
        })
      }
    }
    if (data.loginMode === "existing" && !data.userId) {
      ctx.addIssue({ path: ["userId"], code: z.ZodIssueCode.custom, message: "Select an account to link" })
    }
  })

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase).optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.number().positive().optional(),
  positionId: z.number().positive().optional(),
  outletId: z.number().positive().optional(),
  photoUrl: z.string().optional(),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  requiresAttendance: z.boolean().optional(),
  emergencyContactName: z.string().transform(toTitleCase).optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export const createPositionSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  defaultRoleId: z.number().positive().optional(),
})

export type CreatePositionInput = z.infer<typeof createPositionSchema>

export const updatePositionSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase).optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only")
    .optional(),
  description: z.string().optional(),
  defaultRoleId: z.number().positive().optional(),
})

export type UpdatePositionInput = z.infer<typeof updatePositionSchema>
