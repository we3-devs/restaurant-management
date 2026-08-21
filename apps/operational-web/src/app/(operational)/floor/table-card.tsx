"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreVerticalIcon } from "lucide-react"

import { cn } from "@rms/ui/cn"
import type { DiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { TableActionsDialog } from "./table-actions-dialog"

const STATUS_STYLES: Record<string, string> = {
  available: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  occupied: "border-destructive bg-destructive/10 text-destructive",
  reserved: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cleaning: "border-muted bg-muted text-muted-foreground",
  inactive: "border-muted bg-muted/50 text-muted-foreground opacity-60",
}

export function TableCard({
  table,
  arrivingAt,
  basePath = "/pos",
}: {
  table: DiningTable
  arrivingAt?: string
  /** Where tapping the card navigates for order-taking — desktop POS by default, staff mobile passes its own route. */
  basePath?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => router.push(`${basePath}?tableId=${table.id}`)}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 text-center transition-colors hover:opacity-80",
            STATUS_STYLES[table.status] ?? STATUS_STYLES.available,
          )}
        >
          <span className="text-sm font-semibold">{table.name}</span>
          <span className="text-xs capitalize">{table.status}</span>
          <span className="text-xs opacity-75">seats {table.capacity}</span>
        </button>
        {arrivingAt && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-500/50 bg-amber-500 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm">
            Arriving {new Date(arrivingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label="More table actions"
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md text-current opacity-60 hover:bg-black/10 hover:opacity-100"
        >
          <MoreVerticalIcon className="size-4" />
        </button>
      </div>
      {open && <TableActionsDialog table={table} onClose={() => setOpen(false)} />}
    </>
  )
}
