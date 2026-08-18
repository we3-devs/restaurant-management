import { z } from "zod"

export const CUSTOMER_CREDIT_TRANSACTION_TYPES = [
  "charge",
  "settlement",
  "adjustment",
  "refund_reversal",
] as const

export const settleCustomerDebtSchema = z.object({
  customerId: z.number({ message: "Select a customer" }).positive(),
  amount: z.number().positive("Amount must be greater than zero"),
  notes: z.string().optional(),
})

export type SettleCustomerDebtInput = z.infer<typeof settleCustomerDebtSchema>

export const adjustCustomerCreditSchema = z.object({
  customerId: z.number({ message: "Select a customer" }).positive(),
  delta: z.number().refine((v) => v !== 0, "Delta cannot be zero"),
  notes: z.string().optional(),
})

export type AdjustCustomerCreditInput = z.infer<typeof adjustCustomerCreditSchema>

export const setCustomerCreditLimitSchema = z.object({
  creditLimit: z.number().min(0, "Credit limit cannot be negative"),
})

export type SetCustomerCreditLimitInput = z.infer<typeof setCustomerCreditLimitSchema>
