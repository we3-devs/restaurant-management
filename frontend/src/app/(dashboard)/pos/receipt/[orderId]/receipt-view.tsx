"use client"

import { PrinterIcon } from "lucide-react"

import { BillReceipt } from "@/components/bill-receipt"
import { Button } from "@/components/ui/button"
import { useOrder } from "@/hooks/use-orders"

export function ReceiptView({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)

  if (!order) return null

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
