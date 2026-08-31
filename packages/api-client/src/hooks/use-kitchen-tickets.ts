import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queuableApiClient } from "../offline/queuable-api-client"
import { queryKeys } from "../query-keys"
import { applyBulkTransition, applyItemStatus } from "../kitchen/optimistic-bootstrap"
import type { OutletDepartment } from "./use-outlet-departments"

export interface KitchenTicketOrderItem {
  id: number
  foodId: number
  foodVariantId: number | null
  quantity: number
  unitPrice: number
  totalAmount: number
  note: string | null
  food?: { id: number; name: string }
  foodVariant?: { id: number; name: string } | null
}

export interface KitchenTicketItem {
  id: number
  ticketId: number
  orderItemId: number
  status: "sent_to_kitchen" | "preparing" | "ready" | "served" | "cancelled"
  startedAt: string | null
  readyAt: string | null
  servedAt: string | null
  recalledAt: string | null
  recallCount: number
  orderItem?: KitchenTicketOrderItem
}

export interface KitchenTicket {
  id: number
  orderId: number
  outletId: number
  departmentId: number | null
  status: "open" | "in_progress" | "completed" | "cancelled"
  priority: "normal" | "high" | "urgent"
  startedAt: string | null
  readyAt: string | null
  servedAt: string | null
  recalledAt: string | null
  recallCount: number
  createdAt: string
  updatedAt: string
  department?: OutletDepartment | null
  items?: KitchenTicketItem[]
  order?: {
    id: number
    orderNumber: string
    tableSession?: { id: number; diningTable?: { id: number; name: string } } | null
  }
}

export interface KdsBootstrap {
  stations: OutletDepartment[]
  tickets: KitchenTicket[]
}

export function useKdsBootstrap(outletId: number | null) {
  return useQuery({
    queryKey: queryKeys.kitchenTickets.bootstrap(outletId),
    queryFn: () => apiClient<KdsBootstrap>(`/kitchen-tickets/bootstrap?outletId=${outletId}`),
    enabled: !!outletId && outletId > 0,
    refetchInterval: 60_000, // fallback in case a websocket event is missed
  })
}

/**
 * The item-status PATCH and the ticket-level bulk actions below are
 * transition-based, not absolute-value — replaying one after it already
 * applied (e.g. the response was lost after a flaky kitchen wifi hop) gets
 * a 400 from the server instead of a no-op. queuableApiClient's
 * convergentOnBadRequest flag tells the offline replay loop to treat that
 * specific case as "already converged" and drop the entry instead of
 * getting stuck — see mutation-queue.ts.
 */
export function useUpdateKitchenTicketItemStatus(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, itemId, status }: { ticketId: number; itemId: number; status: KitchenTicketItem["status"] }) =>
      queuableApiClient<KitchenTicket>(
        `/kitchen-tickets/${ticketId}/items/${itemId}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        "Update kitchen ticket item status",
        { convergentOnBadRequest: true },
      ),
    onMutate: async ({ ticketId, itemId, status }) => {
      const key = queryKeys.kitchenTickets.bootstrap(outletId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<KdsBootstrap>(key)
      if (previous) queryClient.setQueryData<KdsBootstrap>(key, applyItemStatus(previous, ticketId, itemId, status))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.kitchenTickets.bootstrap(outletId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

/**
 * Shared wrapper for the ticket-level batch actions (start / mark-ready /
 * mark-served). Invalidates the KDS bootstrap AND all order queries so a
 * POS screen watching the same order flips its item status badges live.
 */
function useKitchenTicketAction(
  outletId: number | null,
  pathSuffix: string,
  fromStatuses: KitchenTicketItem["status"][],
  toStatus: KitchenTicketItem["status"],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: number) =>
      queuableApiClient<KitchenTicket>(
        `/kitchen-tickets/${ticketId}${pathSuffix}`,
        { method: "POST" },
        `Kitchen ticket${pathSuffix.replace("/", " ").replace("-", " ")}`,
        { convergentOnBadRequest: true },
      ),
    onMutate: async (ticketId) => {
      const key = queryKeys.kitchenTickets.bootstrap(outletId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<KdsBootstrap>(key)
      if (previous) queryClient.setQueryData<KdsBootstrap>(key, applyBulkTransition(previous, ticketId, fromStatuses, toStatus))
      return { previous }
    },
    onError: (_err, _ticketId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.kitchenTickets.bootstrap(outletId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useStartKitchenTicket(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/start", ["sent_to_kitchen"], "preparing")
}

export function useMarkKitchenTicketReady(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/mark-ready", ["sent_to_kitchen", "preparing"], "ready")
}

export function useMarkKitchenTicketServed(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/mark-served", ["ready"], "served")
}

export function useUpdateKitchenTicketPriority(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, priority }: { ticketId: number; priority: string }) =>
      apiClient<KitchenTicket>(`/kitchen-tickets/${ticketId}/priority`, {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useCancelKitchenTicket(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: number) =>
      apiClient<KitchenTicket>(`/kitchen-tickets/${ticketId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useRecallKitchenTicketItem(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, itemId }: { ticketId: number; itemId: number }) =>
      apiClient<KitchenTicket>(`/kitchen-tickets/${ticketId}/items/${itemId}/recall`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
