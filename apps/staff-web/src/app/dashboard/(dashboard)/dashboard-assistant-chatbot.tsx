"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { BotIcon, MessageCircleIcon, SendIcon, Trash2Icon, UserIcon, XIcon } from "lucide-react"

import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { apiClient } from "@rms/api-client/client"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { AssistantMessage } from "./assistant-message"

type ChatResult = { route: string; answer: string }
type ChatMessage = { id: number; role: "user" | "assistant"; text: string; route?: string }

// Distance (in px) the pointer must travel before a press on the bubble
// counts as a drag rather than a click that opens the chat.
const DRAG_THRESHOLD = 4
// Kept clear of the viewport edge, in both the default corner and wherever
// the bubble gets dragged to.
const EDGE_MARGIN = 8
const POSITION_STORAGE_KEY = "assistant-bubble-position"

type BubblePosition = { right: number; bottom: number }

function clampPosition(right: number, bottom: number, width: number, height: number): BubblePosition {
  const maxRight = Math.max(window.innerWidth - width - EDGE_MARGIN, EDGE_MARGIN)
  const maxBottom = Math.max(window.innerHeight - height - EDGE_MARGIN, EDGE_MARGIN)
  return {
    right: Math.min(Math.max(right, EDGE_MARGIN), maxRight),
    bottom: Math.min(Math.max(bottom, EDGE_MARGIN), maxBottom),
  }
}

// Module-level store (same shape as use-sidebar-collapsed.ts) rather than
// component state: the stored position is only safe to read once mounted in
// the browser, and reading it inside an effect via setState would mismatch
// the server-rendered default corner and cause a hydration flash/warning.
let bubblePosition: BubblePosition | null = null
let hydrated = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function updateBubblePosition(next: BubblePosition | null) {
  bubblePosition = next
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return bubblePosition
}

// Server (and the client's very first render, pre-hydration) always sees the
// default corner — the real stored position is only read once, from an
// effect below, so the client's first paint matches what the server sent.
function getServerSnapshot() {
  return null
}

export function DashboardAssistantChatbot() {
  const { outletId } = useActiveOutlet()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const endOfMessages = useRef<HTMLDivElement>(null)

  // Position is remembered per device (like the receipt paper size), not
  // per tenant — null means "use the default bottom-right corner".
  const position = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startRight: 0, startBottom: 0 })

  useEffect(() => {
    if (hydrated) return
    hydrated = true
    try {
      const stored = localStorage.getItem(POSITION_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as BubblePosition
      if (typeof parsed.right === "number" && typeof parsed.bottom === "number") {
        updateBubblePosition(clampPosition(parsed.right, parsed.bottom, 48, 48))
      }
    } catch {
      // Ignore a corrupt/blocked value — falls back to the default corner.
    }
  }, [])

  // Re-clamps whenever the rendered size changes (opening the panel, or the
  // viewport resizing) so a bubble dragged near an edge never lets the much
  // larger open panel spill off-screen.
  useLayoutEffect(() => {
    function reclamp() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const right = window.innerWidth - rect.right
      const bottom = window.innerHeight - rect.bottom
      const clamped = clampPosition(right, bottom, rect.width, rect.height)
      if (clamped.right !== right || clamped.bottom !== bottom) updateBubblePosition(clamped)
    }
    reclamp()
    window.addEventListener("resize", reclamp)
    return () => window.removeEventListener("resize", reclamp)
  }, [open])

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = {
      dragging: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const state = dragState.current
    if (!state.dragging) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    state.moved = true
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    updateBubblePosition(clampPosition(state.startRight - dx, state.startBottom - dy, rect.width, rect.height))
  }

  function handlePointerUp() {
    const state = dragState.current
    state.dragging = false
    if (!state.moved || !bubblePosition) return
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(bubblePosition))
    } catch {
      // Storage blocked — the position still holds for this page session.
    }
  }

  function handleBubbleClick() {
    // A drag ends with the same click event the browser fires on release —
    // swallow it so dropping the bubble doesn't also pop the chat open.
    if (dragState.current.moved) {
      dragState.current.moved = false
      return
    }
    setOpen(true)
  }

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
    <div
      ref={containerRef}
      className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6"
      style={position ? { right: position.right, bottom: position.bottom } : undefined}
    >
      {open && (
        <Card className="mb-3 flex h-[min(680px,calc(100dvh-2rem))] w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-card shadow-popover">
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
          className="ml-auto size-12 touch-none rounded-full bg-primary p-0 text-primary-foreground shadow-popover transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleBubbleClick}
          aria-label="Talk to Restra AI — drag to move"
          title="Talk to Restra AI (drag to move)"
        >
          <MessageCircleIcon className="size-5" strokeWidth={2.25} />
        </Button>
      )}
    </div>
  )
}
