import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { acquireKdsSocket, releaseKdsSocket } from "../realtime/kds-socket"
import { queryKeys } from "../query-keys"
import type { AppNotification } from "./use-notifications"
import type { KdsBootstrap, KitchenTicket, KitchenTicketItem } from "./use-kitchen-tickets"

/**
 * Keeps the KDS bootstrap query fresh via push updates instead of relying
 * solely on its 30s polling fallback. Deliberately just invalidates on any
 * ticket/item event rather than merging the payload into the cache by hand
 * — the bootstrap response is a deep nested shape (order -> tableSession ->
 * diningTable, items -> orderItem -> food), and a full refetch is cheap and
 * far less error-prone than keeping a hand-rolled merge in sync with it.
 *
 * Also invalidates notification/service-request data on their realtime pushes.
 * Toast presentation is centralized in useNotificationsRealtime so every
 * notification type gets one toast, regardless of which operational page is open.
 */
export function useKitchenRealtime(outletId: number | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!outletId) return

    const socket = acquireKdsSocket()

    const bootstrapKey = queryKeys.kitchenTickets.bootstrap(outletId)
    const patchTicket = (ticket: KitchenTicket, append: boolean) => {
      queryClient.setQueryData<KdsBootstrap>(bootstrapKey, (current) => {
        if (!current) return current
        const index = current.tickets.findIndex((candidate) => candidate.id === ticket.id)
        if (index === -1) return append ? { ...current, tickets: [...current.tickets, ticket] } : current
        if (ticket.status === "completed" || ticket.status === "cancelled") {
          return { ...current, tickets: current.tickets.filter((candidate) => candidate.id !== ticket.id) }
        }
        const tickets = current.tickets.slice()
        tickets[index] = {
          ...tickets[index],
          ...ticket,
          ...(ticket.items !== undefined ? { items: ticket.items } : {}),
          ...(ticket.order !== undefined ? { order: ticket.order } : {}),
          ...(ticket.department !== undefined ? { department: ticket.department } : {}),
        }
        return { ...current, tickets }
      })
    }
    const patchItem = (item: KitchenTicketItem) => {
      queryClient.setQueryData<KdsBootstrap>(bootstrapKey, (current) => {
        if (!current) return current
        const tickets = current.tickets.map((ticket) =>
          ticket.id === item.ticketId
            ? { ...ticket, items: ticket.items?.map((candidate) => candidate.id === item.id ? { ...candidate, ...item } : candidate) }
            : ticket,
        )
        return { ...current, tickets }
      })
    }

    // Kitchen item status changes land in table_session_food_status_counts,
    // which every status display reads, and finishing an order can auto-end
    // its table session — so any open order/floor screen (POS cart, order
    // detail, guest tracker, floor board) must refetch too.
    //
    // tableSessions.all, not .lists(): the session status-counts key is a
    // sibling of .lists(), so invalidating .lists() alone left the rollup
    // stale indefinitely whenever the KDS socket was connected (its polling
    // fallback is disabled in that case). The counts table can't announce
    // itself either — it's written by a SQL trigger, which the TypeORM
    // entity subscriber behind the generic resource.changed bus can't see.
    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    }
    // The hand-merges above are an optimistic first paint, not the source of
    // truth: nothing else invalidated the bootstrap, so anything they got
    // wrong (or any event missed while the tab was backgrounded) stuck on the
    // board until a remount. This is what makes the KDS self-correct.
    const invalidateKds = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.all })
    }
    const invalidateService = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all })
    }

    const subscribe = () => socket.emit("subscribe-outlet", { outletId })
    const onTicketCreated = (ticket: KitchenTicket) => {
      patchTicket(ticket, true)
      invalidateOrders()
      invalidateKds()
    }
    const onTicketUpdated = (ticket: KitchenTicket) => {
      patchTicket(ticket, false)
      invalidateOrders()
      invalidateKds()
    }
    const onItemUpdated = (item: KitchenTicketItem) => {
      patchItem(item)
      invalidateOrders()
      invalidateKds()
    }
    const onNotificationCreated = (notification: AppNotification) => {
      invalidateService()
      if (notification.type === "guest_order_placed" || notification.type === "order_sent") {
        invalidateOrders()
      }
      // Kitchen-side notifications announce work the board must already be
      // showing — a ready/recall/cancel that arrives as a notification but
      // whose ticket event was dropped would otherwise leave the two screens
      // disagreeing.
      if (notification.type?.startsWith("kitchen_")) {
        invalidateKds()
      }
    }
    const onServiceRequestCreated = () => invalidateService()

    socket.on("connect", subscribe)
    socket.on("kitchen.ticket.created", onTicketCreated)
    socket.on("kitchen.ticket.updated", onTicketUpdated)
    socket.on("kitchen.item.updated", onItemUpdated)
    socket.on("notification.created", onNotificationCreated)
    socket.on("service_request.created", onServiceRequestCreated)
    if (socket.connected) subscribe()

    return () => {
      socket.off("connect", subscribe)
      socket.off("kitchen.ticket.created", onTicketCreated)
      socket.off("kitchen.ticket.updated", onTicketUpdated)
      socket.off("kitchen.item.updated", onItemUpdated)
      socket.off("notification.created", onNotificationCreated)
      socket.off("service_request.created", onServiceRequestCreated)
      releaseKdsSocket()
    }
  }, [outletId, queryClient])
}
