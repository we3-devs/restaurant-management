"use client"

import { toast } from "sonner"

import { StatusBadge } from "@rms/ui/status-badge"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { DetailPageSkeleton, NotFoundCard } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { tableSessionName, useEndTableSession, useTableSession } from "@rms/api-client/hooks/use-table-sessions"

export function TableSessionDetail({ sessionId }: { sessionId: number }) {
  const { data: session, isLoading } = useTableSession(sessionId)
  const showSkeleton = useDelayedLoading(isLoading)
  const endSession = useEndTableSession(sessionId)

  async function handleEnd() {
    try {
      await endSession.mutateAsync()
      toast.success("Session ended")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end session")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !session) return <NotFoundCard resource="Table session" />
  if (!session) return null

  const isActive = session.status === "active" || session.status === "billing"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Table Session — {tableSessionName(session)}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">
              {session.diningTableName ?? "Loading…"}
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
            {session.outletName ?? "Loading…"}
          </p>
          <p>
            <span className="text-muted-foreground">Table:</span>{" "}
            {session.diningTableName ?? "Loading…"}
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
