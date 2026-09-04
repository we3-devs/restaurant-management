"use client"

import { useState } from "react"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { apiClient } from "@rms/api-client/client"

type ChatResult = { route: string; answer: string }

export function AssistantPanel() {
  const [question, setQuestion] = useState("")
  const [outletId, setOutletId] = useState("")
  const [answer, setAnswer] = useState<ChatResult | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  async function ask() {
    if (!question.trim()) return
    setBusy(true); setMessage("")
    try { setAnswer(await apiClient<ChatResult>("/assistant/chat", { method: "POST", body: JSON.stringify({ question, outletId: outletId ? Number(outletId) : undefined }) })) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to answer") }
    finally { setBusy(false) }
  }

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Operations Assistant</h1><p className="text-sm text-muted-foreground">Read-only access to aggregate database analytics. Admins only.</p></div><Card><CardHeader><CardTitle>Ask a question</CardTitle><CardDescription>English, Romanized Nepali, or mixed language is supported.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input className="max-w-44" value={outletId} onChange={(event) => setOutletId(event.target.value)} placeholder="Outlet ID (optional)" /><Input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask() }} placeholder="e.g. aaja kati booking vayo?" /><Button onClick={() => void ask()} disabled={busy}>Ask</Button></div>{answer && <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap"><div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{answer.route}</div>{answer.answer}</div>}</CardContent></Card>{message && <p className="text-sm text-muted-foreground">{message}</p>}</div>
}
