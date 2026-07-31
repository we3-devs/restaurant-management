import { z } from "zod"

const TIME_REGEX = /^\d{2}:\d{2}$/

export const createShiftSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  startTime: z.string().regex(TIME_REGEX, "Use HH:MM format"),
  endTime: z.string().regex(TIME_REGEX, "Use HH:MM format"),
  breakDurationMinutes: z.number().min(0).optional(),
  workingHours: z.number().min(0).optional(),
  description: z.string().optional(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
})

export type CreateShiftInput = z.infer<typeof createShiftSchema>

export const updateShiftSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only")
    .optional(),
  startTime: z.string().regex(TIME_REGEX, "Use HH:MM format").optional(),
  endTime: z.string().regex(TIME_REGEX, "Use HH:MM format").optional(),
  breakDurationMinutes: z.number().min(0).optional(),
  workingHours: z.number().min(0).optional(),
  description: z.string().optional(),
})

export type UpdateShiftInput = z.infer<typeof updateShiftSchema>

export const assignShiftSchema = z.object({
  shiftId: z.number().positive(),
  employeeId: z.number({ message: "Select an employee" }).positive(),
  assignedDate: z.string().min(1, "Pick a date"),
})

export type AssignShiftInput = z.infer<typeof assignShiftSchema>
