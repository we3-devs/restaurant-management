import type { KitchenTicket } from "../hooks/use-kitchen-tickets"

export type TicketStage = "incoming" | "preparing" | "ready"

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function elapsedMinutes(since: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000))
}

/**
 * A ticket lives in one column at a time, derived from the statuses of its
 * items. Ticket-level Start/Mark Ready move every item together, so tickets
 * progress uniformly — per-item edge cases (recall/cancel) just shift the
 * dominant stage.
 *
 * Shared by the desktop KDS board and the staff mobile kitchen screen — do
 * not fork this logic, both UIs must agree on which column a ticket is in.
 */
export function ticketStage(ticket: KitchenTicket): TicketStage {
  const items = ticket.items ?? []
  const active = items.filter((item) => item.status !== "cancelled")
  const statuses = new Set(active.map((item) => item.status))
  // Sent items still wait to be started, so any of them keeps the ticket in
  // Incoming — even alongside already-ready items (reachable via order-detail
  // item edits) — otherwise a stranded sent item would sit invisible under a
  // "ready" ticket. Mark Ready will bulk-move both sent + preparing anyway.
  if (statuses.has("sent_to_kitchen")) return "incoming"
  if (statuses.has("preparing")) return "preparing"
  return "ready"
}
