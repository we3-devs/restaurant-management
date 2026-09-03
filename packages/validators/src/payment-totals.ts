export interface PaymentTotalEntry {
  amount: number
  type: "payment" | "refund" | string
  status: "completed" | string
}

export interface PaymentTotals {
  paidAmount: number
  refundedAmount: number
  dueAmount: number
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded"
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Canonical calculation for all order payment totals. */
export function calculatePaymentTotals(grandTotal: number, entries: PaymentTotalEntry[]): PaymentTotals {
  const completed = entries.filter((entry) => entry.status === "completed")
  const grossPaid = round2(
    completed.filter((entry) => entry.type === "payment").reduce((sum, entry) => sum + entry.amount, 0),
  )
  const refundedAmount = round2(
    completed.filter((entry) => entry.type === "refund").reduce((sum, entry) => sum + entry.amount, 0),
  )
  const paidAmount = round2(grossPaid - refundedAmount)
  const dueAmount = Math.max(round2(grandTotal - paidAmount), 0)

  return {
    paidAmount,
    refundedAmount,
    dueAmount,
    paymentStatus:
      refundedAmount > 0 && refundedAmount >= grossPaid
        ? "refunded"
        : paidAmount <= 0
          ? "unpaid"
          : paidAmount >= grandTotal
            ? "paid"
            : "partial",
  }
}
