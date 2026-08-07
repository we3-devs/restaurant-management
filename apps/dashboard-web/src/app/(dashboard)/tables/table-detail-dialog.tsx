"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useOrders } from "@/hooks/use-orders"
import { useTableSessions } from "@/hooks/use-table-sessions"
import type { DiningTable } from "@/hooks/use-dining-tables"
import { DownloadableQrCode } from "./downloadable-qr-code"

const OPERATIONAL_WEB_URL = process.env.NEXT_PUBLIC_OPERATIONAL_WEB_URL ?? "http://localhost:3100"

function formatSeatedFor(startedAt: string | null): string | null {
  if (!startedAt) return null
  const minutes = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
  if (minutes < 1) return "just seated"
  if (minutes < 60) return `seated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `seated ${hours}h${remainder ? ` ${remainder}m` : ""} ago`
}

/** Read-only guest/session detail + downloadable guest-ordering QR for a table — no session or order actions here, those stay in operational-web. */
export function TableDetailDialog({ table, onClose }: { table: DiningTable; onClose: () => void }) {
  const { data: sessions } = useTableSessions({ diningTableId: table.id, status: "active", limit: 1 })
  const activeSession = sessions?.data[0]
  const { data: orders } = useOrders({ tableSessionId: activeSession?.id, limit: 1 }, { enabled: !!activeSession })
  const activeOrder = orders?.data[0]

  const guestUrl = table.code ? `${OPERATIONAL_WEB_URL}/guest?table=${table.code}` : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {table.name} &mdash; {table.status}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {table.status === "occupied" && activeSession ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{activeSession.customer?.name ?? "Walk-in guest"}</p>
                <p className="text-sm text-muted-foreground">
                  {activeSession.guestCount} of {table.capacity} seat{table.capacity === 1 ? "" : "s"} &middot; session #
                  {activeSession.id}
                </p>
                {formatSeatedFor(activeSession.startedAt) && (
                  <p className="text-sm text-muted-foreground">{formatSeatedFor(activeSession.startedAt)}</p>
                )}
              </div>

              {activeSession.customer && (activeSession.customer.phone || activeSession.customer.loyaltyTier) && (
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2 text-sm">
                  {activeSession.customer.phone ? (
                    <p className="text-muted-foreground">{activeSession.customer.phone}</p>
                  ) : (
                    <span />
                  )}
                  {activeSession.customer.loyaltyTier && (
                    <Badge variant="secondary">{activeSession.customer.loyaltyTier}</Badge>
                  )}
                </div>
              )}

              {activeOrder && (
                <Link
                  href={`/orders/${activeOrder.id}`}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="text-muted-foreground">Order so far &middot; {activeOrder.orderNumber}</span>
                  <div className="text-right">
                    <p className="font-medium">{activeOrder.grandTotal.toFixed(2)}</p>
                    {activeOrder.dueAmount > 0 && (
                      <p className="text-xs text-muted-foreground">{activeOrder.dueAmount.toFixed(2)} due</p>
                    )}
                  </div>
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {table.status === "available" && "This table is free."}
              {table.status === "reserved" && "This table is reserved for an upcoming booking."}
              {table.status === "cleaning" && "This table is being cleaned and isn't ready for guests yet."}
              {table.status === "inactive" && "This table isn't in service right now."}
            </p>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Guest ordering QR</p>
            {guestUrl ? (
              <DownloadableQrCode value={guestUrl} fileName={`table-${table.code}-qr`} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This table has no code set, so it can&apos;t have a guest ordering QR yet.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
