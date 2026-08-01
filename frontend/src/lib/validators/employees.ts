import { z } from "zod"

export const EMPLOYMENT_STATUSES = ["active", "inactive", "terminated", "resigned"] as const

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.number().positive().optional(),
  positionId: z.number().positive().optional(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  departmentId: z.number().positive().optional(),
  photoUrl: z.string().optional(),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.number().positive().optional(),
  positionId: z.number().positive().optional(),
  departmentId: z.number().positive().optional(),
  photoUrl: z.string().optional(),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export const createPositionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  defaultRoleId: z.number().positive().optional(),
})

export type CreatePositionInput = z.infer<typeof createPositionSchema>

export const updatePositionSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only")
    .optional(),
  description: z.string().optional(),
  defaultRoleId: z.number().positive().optional(),
})

export type UpdatePositionInput = z.infer<typeof updatePositionSchema>
