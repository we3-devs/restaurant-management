"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePageTitle } from "@rms/ui/use-page-title"

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? "Request failed")
  return body?.data ?? body
}

export default function AnalyticsMaintenancePage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState(today)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ refreshed: string[]; message?: string } | null>(null)
  usePageTitle("Analytics Data")

  async function run(path: string) {
    setRunning(true)
    setResult(null)
    try {
      const data = await request<{ refreshed: string[]; message?: string }>(path, { method: "POST" })
      setResult(data)
      toast.success(data.message ?? `Processed ${data.refreshed.length} business days`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analytics processing failed")
    } finally {
      setRunning(false)
    }
  }

  return <div className="page-shell max-w-4xl space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics Data</h1>
    <Card><CardHeader><CardTitle>Build daily analytics snapshots</CardTitle><CardDescription>Process real historical domain data into the analytics table. Existing dates are safely overwritten with fresh aggregates.</CardDescription></CardHeader><CardContent className="space-y-5">
      <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm"><span className="text-muted-foreground">From</span><input type="date" className="h-9 rounded-xl border border-border/70 bg-background px-3" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="grid gap-1 text-sm"><span className="text-muted-foreground">To</span><input type="date" className="h-9 rounded-xl border border-border/70 bg-background px-3" value={to} onChange={(event) => setTo(event.target.value)} /></label><Button disabled={running} onClick={() => void run(`/analytics/daily/backfill?to=${to}`)}>Backfill all history</Button><Button variant="outline" disabled={running || !from || !to} onClick={() => void run(`/analytics/daily/refresh?from=${from}&to=${to}`)}>Refresh selected range</Button></div>
      <p className="text-xs text-muted-foreground">Backfill discovers the earliest accessible order automatically and processes one business day at a time. Use refresh for a bounded rebuild.</p>
      {running && <p className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3 text-sm">Processing daily snapshots. This may take a while for large history ranges.</p>}
      {result && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm"><span className="font-medium">Completed.</span> {result.message ?? `${result.refreshed.length} dates processed.`}</div>}
    </CardContent></Card>
  </div>
}
