"use client"

import { useState } from "react"

/**
 * Owns StartSaleDialog's mount + open state so the dialog — and the data
 * hooks it fires (table-sessions, customers) — aren't in the tree until
 * actually needed: either the user taps "Start sale" or a preselected-table
 * deep link requires it open immediately. `mounted` only ever flips false ->
 * true, once, on first need — after that, closing/reopening just toggles
 * `open` on the already-mounted dialog instead of tearing it down and
 * re-fetching. Shared by (dashboard)/pos and staff/pos, which render
 * identical Start Sale flows.
 */
export function useStartSaleDialogState(preselectedTableId: number | undefined) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Arriving via a table-card click (?tableId=...) on an empty table — open
  // straight into the walk-in form instead of making the user tap "Start
  // sale" themselves. Adjusts state during render (not an effect) per
  // React's "adjusting state when a prop changes" pattern — same idiom
  // CheckoutPanel/TableSessionCheckout already use for re-seeding fields.
  const [seededTableId, setSeededTableId] = useState<number | undefined>(undefined)
  if (preselectedTableId !== undefined && preselectedTableId !== seededTableId) {
    setSeededTableId(preselectedTableId)
    setOpen(true)
    setMounted(true)
  }

  function openDialog() {
    setOpen(true)
    setMounted(true)
  }

  return { open, mounted, openDialog, onOpenChange: setOpen }
}
