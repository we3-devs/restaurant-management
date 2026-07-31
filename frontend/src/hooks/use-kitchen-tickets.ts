import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"
import type { OutletDepartment } from "./use-outlet-departments"

export interface KitchenTicketOrderItem {
  id: number
  foodId: number
  foodVariantId: number | null
  quantity: number
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
    refetchInterval: 30_000, // fallback in case a websocket event is missed
  })
}

export function useUpdateKitchenTicketItemStatus(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, itemId, status }: { ticketId: number; itemId: number; status: string }) =>
      apiClient<KitchenTicket>(`/kitchen-tickets/${ticketId}/items/${itemId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
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
function useKitchenTicketAction(outletId: number | null, pathSuffix: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: number) =>
      apiClient<KitchenTicket>(`/kitchen-tickets/${ticketId}${pathSuffix}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useStartKitchenTicket(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/start")
}

export function useMarkKitchenTicketReady(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/mark-ready")
}

export function useMarkKitchenTicketServed(outletId: number | null) {
  return useKitchenTicketAction(outletId, "/mark-served")
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
