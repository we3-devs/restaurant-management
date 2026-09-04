"use client"

import { PrinterIcon } from "lucide-react"

import { BillReceipt } from "@rms/ui/bill-receipt"
import { Button } from "@rms/ui/button"
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
      <div className="no-print flex justify-end">
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          Print
        </Button>
      </div>

      <div id="receipt" className="rounded-lg border border-input p-6 print:w-[80mm]">
        <BillReceipt orderId={orderId} />
      </div>
    </div>
  )
}
