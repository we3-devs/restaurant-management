"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon } from "lucide-react"

import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { apiClient } from "@rms/api-client/client"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

type ChatResult = { route: string; answer: string }

export function DashboardAssistantChatbot() {
  const { outletId } = useActiveOutlet()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<ChatResult | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  async function ask() {
    if (!question.trim() || busy) return
    setBusy(true)
    setMessage("")
    try {
      setAnswer(await apiClient<ChatResult>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ question: question.trim(), outletId: outletId ?? undefined }),
      }))
      setQuestion("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to answer")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {open && (
        <Card className="mb-3 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div><CardTitle className="text-base">Operations Assistant</CardTitle><p className="text-xs text-muted-foreground">Ask about your operations</p></div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant"><XIcon /></Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {answer && <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">{answer.route}</p>{answer.answer}</div>}
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex gap-2">
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask() }} placeholder="Ask a question..." aria-label="Assistant question" />
              <Button onClick={() => void ask()} disabled={busy || !question.trim()}>{busy ? "..." : "Ask"}</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!open && (
        <Button size="icon-lg" className="ml-auto rounded-full shadow-lg" onClick={() => setOpen(true)} aria-label="Open assistant">
          <MessageCircleIcon />
        </Button>
      )}
    </div>
  )
}
