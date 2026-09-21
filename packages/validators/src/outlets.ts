import { z } from "zod"
import { toTitleCase } from "./helpers"

const qrOrderingFields = {
  qrOrderingMode: z.enum(["login", "quick_order"]).optional(),
  qrAccessCheckMode: z.enum(["ip", "geofence", "either", "both"]).optional(),
  qrAccessLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  qrAccessLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  qrAccessRadiusMeters: z.coerce.number().int().min(1).optional().nullable(),
  qrAccessAllowedIp: z.string().ip().optional().nullable().or(z.literal("")),
}

export const createOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  ...qrOrderingFields,
})

export type CreateOutletInput = z.infer<typeof createOutletSchema>

export const updateOutletSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  ...qrOrderingFields,
})

export type UpdateOutletInput = z.infer<typeof updateOutletSchema>
