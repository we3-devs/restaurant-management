import { z } from "zod"
import { toTitleCase } from "./helpers"

const unitTypes = ["weight", "volume", "quantity", "custom"] as const

export const createUnitSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  shortName: z.string().min(1, "Short name is required").max(20),
  type: z.enum(unitTypes),
})

export type CreateUnitInput = z.infer<typeof createUnitSchema>

export const updateUnitSchema = z.object({
  name: z.string().min(1, "Name is required").transform(toTitleCase),
  shortName: z.string().min(1, "Short name is required").max(20),
  type: z.enum(unitTypes),
  isActive: z.boolean(),
})

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

export const createUnitConversionSchema = z.object({
  toUnitId: z.number({ message: "Select a unit" }).positive(),
  multiplier: z.number().positive("Multiplier must be positive"),
})

export type CreateUnitConversionInput = z.infer<typeof createUnitConversionSchema>
