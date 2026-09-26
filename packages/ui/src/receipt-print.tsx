"use client"

import { useRef, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { PrinterIcon } from "lucide-react"

import { BillReceipt } from "./bill-receipt"
import { Button } from "./button"

export const RECEIPT_PAPER_WIDTHS = [58, 80] as const
export type ReceiptPaperWidth = (typeof RECEIPT_PAPER_WIDTHS)[number]

// Paper width is a property of the printer plugged into this terminal, not of
// the tenant — so it's remembered per device rather than in Settings > POS.
const STORAGE_KEY = "receipt-paper-width"
const DEFAULT_PAPER_WIDTH: ReceiptPaperWidth = 80

let paperWidth: ReceiptPaperWidth | null = null
const listeners = new Set<() => void>()

function getPaperWidth(): ReceiptPaperWidth {
  if (paperWidth === null) {
    try {
      paperWidth = localStorage.getItem(STORAGE_KEY) === "58" ? 58 : DEFAULT_PAPER_WIDTH
    } catch {
      paperWidth = DEFAULT_PAPER_WIDTH
    }
  }
  return paperWidth
}

function setPaperWidth(width: ReceiptPaperWidth) {
  paperWidth = width
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // Storage blocked — the choice still holds for this page session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const noopSubscribe = () => () => {}

const PX_PER_MM = 96 / 25.4

/**
 * Prints only the given sheet, on a page exactly as wide as the roll and
 * exactly as long as the bill. A fixed page length is what made thermal
 * printers feed blank paper after short bills, and a fixed 80mm width is what
 * made 58mm printers shrink the whole bill down until the text went faint.
 */
function printSheet(sheet: HTMLElement, width: ReceiptPaperWidth) {
  // +1mm so rounding never spills the last line onto a second page.
  const heightMm = Math.ceil(sheet.getBoundingClientRect().height / PX_PER_MM) + 1
  const pageStyle = document.createElement("style")
  pageStyle.textContent = `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`
  document.head.appendChild(pageStyle)
  document.documentElement.classList.add("printing-receipt")

  window.addEventListener(
    "afterprint",
    () => {
      pageStyle.remove()
      document.documentElement.classList.remove("printing-receipt")
    },
    { once: true }
  )
  window.print()
}

/**
 * Paper-width toggle + Print button for a bill. Prints a dedicated copy of
 * the receipt (rendered off-screen, directly under <body>) rather than the
 * on-screen preview, so the print never inherits the preview's card styling
 * or the height of the page around it.
 */
export function ReceiptPrintButton({ orderId }: { orderId: number }) {
  const width = useSyncExternalStore(subscribe, getPaperWidth, () => DEFAULT_PAPER_WIDTH)
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const sheetRef = useRef<HTMLDivElement>(null)

  return (
    <div className="no-print flex items-center gap-2">
      <div role="group" aria-label="Paper width" className="flex rounded-lg border border-border p-0.5">
        {RECEIPT_PAPER_WIDTHS.map((option) => (
          <Button
            key={option}
            size="xs"
            variant={option === width ? "secondary" : "ghost"}
            aria-pressed={option === width}
            onClick={() => setPaperWidth(option)}
          >
            {option}mm
          </Button>
        ))}
      </div>
      <Button size="sm" onClick={() => sheetRef.current && printSheet(sheetRef.current, width)}>
        <PrinterIcon />
        Print
      </Button>
      {isClient &&
        createPortal(
          <div ref={sheetRef} className="receipt-print-sheet" data-paper={width} aria-hidden="true">
            <BillReceipt orderId={orderId} />
          </div>,
          document.body
        )}
    </div>
  )
}
