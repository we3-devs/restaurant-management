import type { KdsBootstrap, KitchenTicketItem } from "@/hooks/use-kitchen-tickets"

/**
 * Mirrors the backend's ITEM_STATUS_TRANSITIONS (kitchen-tickets.service.ts)
 * closely enough for optimistic UI — the server remains the source of truth
 * and will reject anything actually invalid; this only decides which items
 * a bulk action optimistically flips before the request round-trips.
 */
const ITEM_STATUS_TRANSITIONS: Record<KitchenTicketItem["status"], KitchenTicketItem["status"][]> = {
  sent_to_kitchen: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
}

function withItems(
  bootstrap: KdsBootstrap,
  ticketId: number,
  mapItem: (item: KitchenTicketItem) => KitchenTicketItem,
): KdsBootstrap {
  return {
    ...bootstrap,
    tickets: bootstrap.tickets.map((ticket) =>
      ticket.id !== ticketId ? ticket : { ...ticket, items: (ticket.items ?? []).map(mapItem) },
    ),
  }
}

/** Optimistic version of the ticket-level bulk actions (start/mark-ready/mark-served). */
export function applyBulkTransition(
  bootstrap: KdsBootstrap,
  ticketId: number,
  fromStatuses: KitchenTicketItem["status"][],
  toStatus: KitchenTicketItem["status"],
): KdsBootstrap {
  return withItems(bootstrap, ticketId, (item) =>
    fromStatuses.includes(item.status) ? { ...item, status: toStatus } : item,
  )
}

/** Optimistic version of the single-item status PATCH. */
export function applyItemStatus(
  bootstrap: KdsBootstrap,
  ticketId: number,
  itemId: number,
  status: KitchenTicketItem["status"],
): KdsBootstrap {
  return withItems(bootstrap, ticketId, (item) => (item.id !== itemId ? item : { ...item, status }))
}

export { ITEM_STATUS_TRANSITIONS }
