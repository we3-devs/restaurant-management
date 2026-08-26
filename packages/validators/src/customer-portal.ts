import { z } from "zod"
import { toTitleCase } from "./helpers"

export const requestOtpSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Provide a phone number or email",
  })

export type RequestOtpInput = z.infer<typeof requestOtpSchema>

export const verifyOtpSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    code: z.string().length(6, "Enter the 6-digit code"),
    name: z.string().transform(toTitleCase).optional(),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Provide a phone number or email",
  })

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

export const updateProfileSchema = z.object({
  name: z.string().min(2).transform(toTitleCase).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const updatePreferencesSchema = z.object({
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
})

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>

export const upsertAddressSchema = z.object({
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>
