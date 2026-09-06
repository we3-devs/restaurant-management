"use client"

import { useState } from "react"
import { toast } from "sonner"
import { StatusBadge } from "@rms/ui/status-badge"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { DetailPageSkeleton, NotFoundCard } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { tableSessionName, useAddTableSessionCustomer, useEndTableSession, useRemoveTableSessionCustomer, useTableSession } from "@rms/api-client/hooks/use-table-sessions"

export function TableSessionDetail({ sessionId }: { sessionId: number }) {
  const { data: session, isLoading } = useTableSession(sessionId)
  const showSkeleton = useDelayedLoading(isLoading)
  const endSession = useEndTableSession(sessionId)
  const [customerToAdd, setCustomerToAdd] = useState("")
  const { data: customers } = useCustomers({ limit: 200 })
  const addCustomer = useAddTableSessionCustomer(sessionId)
  const removeCustomer = useRemoveTableSessionCustomer(sessionId)

  async function handleEnd() {
    try { await endSession.mutateAsync(); toast.success("Session ended") }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to end session") }
  }
  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !session) return <NotFoundCard resource="Table session" />
  if (!session) return null

  const isActive = session.status === "active" || session.status === "billing"
  const assignedCustomers = session.customers ?? (session.customer ? [session.customer] : [])

  return <div className="max-w-2xl space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold">Table Session — {tableSessionName(session)}</h1><div className="flex items-center gap-1.5"><p className="text-sm text-muted-foreground">{session.diningTableName ?? "Loading…"}</p><StatusBadge status={session.status} /></div></div>{isActive && <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>{endSession.isPending ? "Ending..." : "End session"}</Button>}</div>
    <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">Outlet:</span> {session.outletName ?? "Loading…"}</p><p><span className="text-muted-foreground">Table:</span> {session.diningTableName ?? "Loading…"}</p><p><span className="text-muted-foreground">Guests:</span> {session.guestCount}</p><p><span className="text-muted-foreground">Source:</span> {session.source}</p><p><span className="text-muted-foreground">Started:</span> {session.startedAt ? new Date(session.startedAt).toLocaleString() : "—"}</p><p><span className="text-muted-foreground">Ended:</span> {session.endedAt ? new Date(session.endedAt).toLocaleString() : "—"}</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Customers at this table</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
      {assignedCustomers.map((customer) => <div key={customer.id} className="flex items-center justify-between gap-3 rounded-md border p-2"><div><p className="font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone || "No phone"}{customer.id === session.customerId ? " · Primary" : ""}</p></div>{customer.id !== session.customerId && <Button variant="ghost" size="sm" onClick={() => removeCustomer.mutate(customer.id)} disabled={removeCustomer.isPending}>Remove</Button>}</div>)}
      {assignedCustomers.length === 0 && <p className="text-muted-foreground">No customers assigned yet.</p>}
      <div className="flex gap-2"><Select value={customerToAdd} onValueChange={(value) => setCustomerToAdd(value ?? "")}><SelectTrigger className="flex-1"><SelectValue placeholder="Add customer" /></SelectTrigger><SelectContent>{(customers?.data ?? []).filter((customer) => !assignedCustomers.some((assigned) => assigned.id === customer.id)).map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}{customer.phone ? ` — ${customer.phone}` : ""}</SelectItem>)}</SelectContent></Select><Button disabled={!customerToAdd || addCustomer.isPending} onClick={() => addCustomer.mutate(Number(customerToAdd), { onSuccess: () => setCustomerToAdd("") })}>Add</Button></div>
    </CardContent></Card>
  </div>
}
