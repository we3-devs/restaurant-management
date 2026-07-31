"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import type { DiningTable } from "@/hooks/use-dining-tables"
import { TableActionsDialog } from "./table-actions-dialog"

const STATUS_STYLES: Record<string, string> = {
  available: "border-secondary bg-secondary/40 text-secondary-foreground",
  occupied: "border-destructive bg-destructive/10 text-destructive",
  reserved: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cleaning: "border-muted bg-muted text-muted-foreground",
  inactive: "border-muted bg-muted/50 text-muted-foreground opacity-60",
}

export function TableCard({ table }: { table: DiningTable }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 text-center transition-colors hover:opacity-80",
          STATUS_STYLES[table.status] ?? STATUS_STYLES.available,
        )}
      >
        <span className="text-sm font-semibold">{table.name}</span>
        <span className="text-xs capitalize">{table.status}</span>
        <span className="text-xs opacity-75">seats {table.capacity}</span>
      </button>
      {open && <TableActionsDialog table={table} onClose={() => setOpen(false)} />}
    </>
  )
}
