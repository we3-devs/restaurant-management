"use client"

import { useEffect, useRef, useState } from "react"
import { BotIcon, MessageCircleIcon, SendIcon, Trash2Icon, UserIcon, XIcon } from "lucide-react"

import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { apiClient } from "@rms/api-client/client"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { AssistantMessage } from "./assistant-message"

type ChatResult = { route: string; answer: string }
type ChatMessage = { id: number; role: "user" | "assistant"; text: string; route?: string }

export function DashboardAssistantChatbot() {
  const { outletId } = useActiveOutlet()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const endOfMessages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, busy])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  async function ask() {
    const trimmed = question.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setMessage("")
    setQuestion("")
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: trimmed }])
    try {
      const result = await apiClient<ChatResult>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ question: trimmed, outletId: outletId ?? undefined }),
      })
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: result.answer, route: result.route }])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to answer")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {open && (
        <Card className="mb-3 flex h-[min(680px,calc(100dvh-2rem))] w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-card bg-none shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div><CardTitle className="text-base">Restra AI</CardTitle><p className="text-xs text-muted-foreground">Your restaurant’s smart sidekick</p></div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && <Button variant="ghost" size="icon" onClick={() => { setMessages([]); setMessage("") }} aria-label="Clear conversation"><Trash2Icon /></Button>}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant"><XIcon /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {messages.length === 0 && <div className="rounded-lg bg-muted p-3 text-sm"><p className="mb-2 font-medium">Hey! What can I help you discover?</p><p className="text-muted-foreground">Ask me about your restaurant’s sales, orders, inventory, or today’s service.</p></div>}
              <div className="space-y-3">
                {messages.map((item) => <div key={item.id} className={`flex gap-2 ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`flex max-w-[88%] gap-2 rounded-lg p-3 text-sm ${item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item.role === "assistant" ? <BotIcon className="mt-0.5 size-4 shrink-0" /> : <UserIcon className="mt-0.5 size-4 shrink-0" />}<div className="whitespace-pre-wrap">{item.route && <p className="mb-1 text-[10px] font-medium uppercase opacity-60">{item.route}</p>}<AssistantMessage text={item.text} /></div></div></div>)}
                {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><BotIcon className="size-4" /> Thinking…</div>}
                <div ref={endOfMessages} />
              </div>
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex gap-2">
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void ask() } }} placeholder="Ask Restra AI about your restaurant…" aria-label="Ask Restra AI a question" />
              <Button size="icon" onClick={() => void ask()} disabled={busy || !question.trim()} aria-label="Send question"><SendIcon /></Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!open && (
        <Button
          size="icon"
          className="ml-auto size-12 rounded-full bg-primary p-0 text-primary-foreground shadow-lg ring-1 ring-primary/30 transition-transform hover:scale-105 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={() => setOpen(true)}
          aria-label="Talk to Restra AI"
          title="Talk to Restra AI"
        >
          <MessageCircleIcon className="size-5" strokeWidth={2.25} />
        </Button>
      )}
    </div>
  )
}
