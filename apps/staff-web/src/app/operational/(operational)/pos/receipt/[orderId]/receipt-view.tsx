"use client"

import { BillReceipt } from "@rms/ui/bill-receipt"
import { ReceiptPrintButton } from "@rms/ui/receipt-print"
import { NotFoundCard, TextSkeleton } from "@rms/ui/skeletons"
import { useOrder } from "@rms/api-client/hooks/use-orders"

export function ReceiptView({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)

  if (isLoading)
    return (
      <div className="mx-auto max-w-[320px] space-y-4">
        <div className="no-print flex justify-end">
          <TextSkeleton lines={1} lastLineWidth="w-24" className="w-24" />
        </div>
        <TextSkeleton lines={6} />
      </div>
    )

  if (!order) return <NotFoundCard resource="Receipt" />

  return (
    <div className="mx-auto max-w-[320px] space-y-4">
      <div className="flex justify-end">
        <ReceiptPrintButton orderId={orderId} />
      </div>

      <div className="rounded-lg border border-input p-6">
        <BillReceipt orderId={orderId} />
      </div>
    </div>
  )
}
