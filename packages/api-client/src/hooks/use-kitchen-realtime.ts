import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
 * Also listens for the outlet's notification/service-request pushes so the
 * POS screen and the Service screen surface "items ready" and "call waiter"
 * events the moment they happen (the header bell watches its own connection
 * for the same notification.created event).
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

    // Kitchen item status changes mirror onto OrderItem.status, and finishing
    // an order can auto-end its table session, so any open order/floor screens
    // (POS cart, order detail, floor board) must refetch too.
    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    }
    const invalidateService = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all })
    }

    const subscribe = () => socket.emit("subscribe-outlet", { outletId })
    const onTicketCreated = (ticket: KitchenTicket) => {
      patchTicket(ticket, true)
      invalidateOrders()
    }
    const onTicketUpdated = (ticket: KitchenTicket) => {
      patchTicket(ticket, false)
      invalidateOrders()
    }
    const onItemUpdated = (item: KitchenTicketItem) => {
      patchItem(item)
      invalidateOrders()
    }
    const onNotificationCreated = (notification: AppNotification) => {
      invalidateService()
      if (notification.type === "kitchen_ready") {
        toast.success(notification.title, {
          description: notification.body ?? undefined,
          duration: 6000,
        })
      } else if (notification.type === "service_request") {
        toast.info(notification.title, {
          description: notification.body ?? "New service request",
          duration: 8000,
        })
      } else if (notification.type === "guest_order_placed") {
        invalidateOrders()
        toast.info(notification.title, {
          description: notification.body ?? "A guest placed a new order",
          duration: 8000,
        })
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
