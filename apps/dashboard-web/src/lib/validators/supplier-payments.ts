import { z } from "zod"

export const PAYMENT_METHODS = ["cash", "bank", "digital"] as const

export const createSupplierPaymentSchema = z.object({
  supplierId: z.number({ message: "Select a supplier" }).positive(),
  purchaseOrderId: z.number().positive().optional(),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  paymentDate: z.string().min(1, "Pick a payment date"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>
