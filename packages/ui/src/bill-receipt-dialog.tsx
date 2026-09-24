"use client"

import type { ReactElement } from "react"
import { PrinterIcon } from "lucide-react"

import { BillReceipt } from "./bill-receipt"
import { Button } from "./button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"

/**
 * The "View / print bill" trigger plus the receipt itself, opened in a
 * modal instead of navigating to the standalone receipt page — used
 * wherever staff need to glance at or print a bill without leaving the
 * checkout flow they're in (POS cart, checkout panel, table checkout).
 */
export function BillReceiptDialog({
  orderId,
  trigger,
}: {
  orderId: number
  /** Override the default "View / print bill" button — e.g. an icon-only trigger for a tight row. */
  trigger?: ReactElement
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <PrinterIcon />
              View / print bill
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader className="no-print flex-row items-center justify-between">
          <DialogTitle>Bill</DialogTitle>
          <Button size="sm" onClick={() => window.print()}>
            <PrinterIcon />
            Print
          </Button>
        </DialogHeader>
        <div id="receipt" className="rounded-lg border border-input p-4 print:w-[80mm]">
          <BillReceipt orderId={orderId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
