import { z } from "zod"

export const LOYALTY_TRANSACTION_TYPES = [
  "earn",
  "redeem",
  "adjustment",
  "expiry",
  "refund_reversal",
] as const

export const adjustLoyaltyPointsSchema = z.object({
  customerId: z.number({ message: "Select a customer" }).positive(),
  delta: z.number().int().refine((v) => v !== 0, "Delta cannot be zero"),
  notes: z.string().optional(),
})

export type AdjustLoyaltyPointsInput = z.infer<typeof adjustLoyaltyPointsSchema>
