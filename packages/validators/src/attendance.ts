import { z } from "zod"

export const ATTENDANCE_STATUSES = ["present", "late", "early_leave", "absent", "half_day"] as const

export const clockInSchema = z.object({
  employeeId: z.number({ message: "Select an employee" }).positive(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  shiftId: z.number().positive().optional(),
})

export type ClockInInput = z.infer<typeof clockInSchema>

export const clockOutSchema = z.object({
  attendanceId: z.number().positive(),
})

export type ClockOutInput = z.infer<typeof clockOutSchema>

export const adjustAttendanceSchema = z.object({
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  notes: z.string().optional(),
})

export type AdjustAttendanceInput = z.infer<typeof adjustAttendanceSchema>
