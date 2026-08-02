"use client"

import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEndTableSession, useTableSession } from "@/hooks/use-table-sessions"

export function TableSessionDetail({ sessionId }: { sessionId: number }) {
  const { data: session, isLoading } = useTableSession(sessionId)
  const endSession = useEndTableSession(sessionId)

  async function handleEnd() {
    try {
      await endSession.mutateAsync()
      toast.success("Session ended")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end session")
    }
  }

  if (isLoading || !session) {
    return <Skeleton className="h-64 w-full max-w-2xl" />
  }

  const isActive = session.status === "active" || session.status === "billing"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Table Session #{session.id}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">
              {session.diningTableName ?? `table #${session.diningTableId}`}
            </p>
            <StatusBadge status={session.status} />
          </div>
        </div>
        {isActive && (
          <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>
            {endSession.isPending ? "Ending..." : "End session"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Outlet:</span>{" "}
            {session.outletName ?? `#${session.outletId}`}
          </p>
          <p>
            <span className="text-muted-foreground">Table:</span>{" "}
            {session.diningTableName ?? `#${session.diningTableId}`}
          </p>
          <p>
            <span className="text-muted-foreground">Guests:</span> {session.guestCount}
          </p>
          <p>
            <span className="text-muted-foreground">Source:</span> {session.source}
          </p>
          <p>
            <span className="text-muted-foreground">Started:</span>{" "}
            {session.startedAt ? new Date(session.startedAt).toLocaleString() : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Ended:</span>{" "}
            {session.endedAt ? new Date(session.endedAt).toLocaleString() : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {session.customer ? (
            <>
              <p>
                <span className="text-muted-foreground">Name:</span> {session.customer.name}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span> {session.customer.phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Loyalty tier:</span>{" "}
                {session.customer.loyaltyTier ?? "—"}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Walk-in — no customer on record for this session.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
