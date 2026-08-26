import { z } from "zod"
import { toTitleCase } from "./helpers"

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

export const updateCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
