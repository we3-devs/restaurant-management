"use client"

import { useRef, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { PrinterIcon } from "lucide-react"

import { BillReceipt } from "./bill-receipt"
import { Button } from "./button"

export const RECEIPT_PAPER_SIZES = [58, 80, "auto"] as const
export type ReceiptPaperSize = (typeof RECEIPT_PAPER_SIZES)[number]

// Paper size is a property of the printer plugged into this terminal, not of
// the tenant — so it's remembered per device rather than in Settings > POS.
const STORAGE_KEY = "receipt-paper-width"
const DEFAULT_PAPER_SIZE: ReceiptPaperSize = 80

let paperSize: ReceiptPaperSize | null = null
const listeners = new Set<() => void>()

function getPaperSize(): ReceiptPaperSize {
  if (paperSize === null) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      paperSize = stored === "58" ? 58 : stored === "auto" ? "auto" : DEFAULT_PAPER_SIZE
    } catch {
      paperSize = DEFAULT_PAPER_SIZE
    }
  }
  return paperSize
}

function setPaperSize(size: ReceiptPaperSize) {
  paperSize = size
  try {
    localStorage.setItem(STORAGE_KEY, String(size))
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
 * Prints only the given sheet. For 58/80mm the page is exactly as wide as the
 * roll and exactly as long as the bill. A fixed page length is what made
 * thermal printers feed blank paper after short bills, and a fixed 80mm width
 * is what made 58mm printers shrink the whole bill down until the text went
 * faint.
 *
 * Chrome centers a page that's shorter than the paper picked in the printer
 * driver, and shrinks one that's wider. So a driver set to a long roll (e.g.
 * 80 × 3276mm) fed blank paper before every bill, and one set narrower than
 * the page printed the bill small and faint. "Auto" leaves the page size to
 * the driver, so the bill starts at the top of the driver's own page — such
 * drivers already cut off the blank paper after it.
 */
function printSheet(sheet: HTMLElement, size: ReceiptPaperSize) {
  let pageSize = ""
  if (size !== "auto") {
    // +1mm so rounding never spills the last line onto a second page.
    const heightMm = Math.ceil(sheet.getBoundingClientRect().height / PX_PER_MM) + 1
    pageSize = `size: ${size}mm ${heightMm}mm; `
  }
  const pageStyle = document.createElement("style")
  pageStyle.textContent = `@page { ${pageSize}margin: 0; }`
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
 * Paper-size toggle + Print button for a bill. Prints a dedicated copy of
 * the receipt (rendered off-screen, directly under <body>) rather than the
 * on-screen preview, so the print never inherits the preview's card styling
 * or the height of the page around it.
 */
export function ReceiptPrintButton({ orderId }: { orderId: number }) {
  const size = useSyncExternalStore(subscribe, getPaperSize, () => DEFAULT_PAPER_SIZE)
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const sheetRef = useRef<HTMLDivElement>(null)

  return (
    <div className="no-print flex items-center gap-2">
      <div role="group" aria-label="Paper size" className="flex rounded-lg border border-border p-0.5">
        {RECEIPT_PAPER_SIZES.map((option) => (
          <Button
            key={option}
            size="xs"
            variant={option === size ? "secondary" : "ghost"}
            aria-pressed={option === size}
            title={
              option === "auto"
                ? "Use the paper size set in the printer's own settings. Try this if the printer feeds blank paper before the bill or prints faint."
                : undefined
            }
            onClick={() => setPaperSize(option)}
          >
            {option === "auto" ? "Auto" : `${option}mm`}
          </Button>
        ))}
      </div>
      <Button size="sm" onClick={() => sheetRef.current && printSheet(sheetRef.current, size)}>
        <PrinterIcon />
        Print
      </Button>
      {isClient &&
        createPortal(
          <div ref={sheetRef} className="receipt-print-sheet" data-paper={size} aria-hidden="true">
            <BillReceipt orderId={orderId} />
          </div>,
          document.body
        )}
    </div>
  )
}
