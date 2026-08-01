import { useEffect } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { toast } from "sonner"
import { apiClient } from "@/lib/api/client"
import { connectKdsSocket } from "@/lib/realtime/kds-socket"
import { queryKeys } from "@/lib/query-keys"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import {
  NOTIFICATION_TOAST_VARIANT,
  TOAST_EVEN_IF_SELF,
  type NotificationPriority,
  type NotificationType,
} from "@/lib/validators/notifications"

export interface AppNotification {
  id: number
  outletId: number
  type: NotificationType
  title: string
  body: string | null
  tableName: string | null
  orderId: number | null
  readAt: string | null
  priority: NotificationPriority
  archivedAt: string | null
  actorUserId: number | null
  createdAt: string
}

export interface NotificationsFeed extends PaginatedResponse<AppNotification> {
  unreadCount: number
}

export interface ListNotificationsParams {
  outletId?: number | null
  page?: number
  limit?: number
  type?: NotificationType
  priority?: NotificationPriority
  read?: boolean
  archived?: boolean
  search?: string
}

export function useNotifications(params: ListNotificationsParams) {
  const { outletId, ...rest } = params
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () =>
      apiClient<NotificationsFeed>(
        `/notifications${toQueryString({ outletId: outletId ?? undefined, ...rest })}`,
      ),
    enabled: !!outletId && outletId > 0,
    placeholderData: keepPreviousData,
  })
}

export function useUnreadNotificationCount(outletId: number | null) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(outletId),
    queryFn: () => apiClient<{ count: number }>(`/notifications/unread-count?outletId=${outletId}`),
    enabled: !!outletId && outletId > 0,
  })
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
  }
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<AppNotification>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: invalidate,
  })
}

export function useMarkAllNotificationsRead(outletId: number | null) {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: () =>
      apiClient<{ count: number }>("/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({ outletId }),
      }),
    onSuccess: invalidate,
  })
}

export function useArchiveNotification() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<AppNotification>(`/notifications/${id}/archive`, { method: "POST" }),
    onSuccess: invalidate,
  })
}

export function useUnarchiveNotification() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<AppNotification>(`/notifications/${id}/unarchive`, { method: "POST" }),
    onSuccess: invalidate,
  })
}

export function useDeleteNotification() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/notifications/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

export interface NotificationPreferences {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  mutedTypes: NotificationType[]
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => apiClient<NotificationPreferences>("/notifications/preferences"),
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) =>
      apiClient<NotificationPreferences>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.notifications.preferences(), data),
  })
}

export function usePushPublicKey() {
  return useQuery({
    queryKey: queryKeys.notifications.pushPublicKey(),
    queryFn: () => apiClient<{ publicKey: string | null; configured: boolean }>("/notifications/push/public-key"),
    staleTime: Infinity,
  })
}

export function useSubscribePush() {
  return useMutation({
    mutationFn: (input: { endpoint: string; p256dh: string; auth: string }) =>
      apiClient<void>("/notifications/push/subscribe", { method: "POST", body: JSON.stringify(input) }),
  })
}

export function useUnsubscribePush() {
  return useMutation({
    mutationFn: (endpoint: string) =>
      apiClient<void>("/notifications/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  })
}

/**
 * Keeps the notification feed fresh via the shared /kds websocket and pops a
 * toast for realtime events — the persistent history lives in the
 * Notification Center; this is just the "immediate feedback" half described
 * in the toast-flow requirement. Self-triggered events are skipped (the
 * mutation that caused them already shows its own success/error toast)
 * except for the explicit allowlist (e.g. payment_received).
 */
export function useNotificationsRealtime(outletId: number | null, currentUserId?: number): void {
  const invalidate = useInvalidateNotifications()

  useEffect(() => {
    if (!outletId) return

    let socket: Socket | undefined
    let cancelled = false

    connectKdsSocket()
      .then((s) => {
        if (cancelled) {
          s.disconnect()
          return
        }
        socket = s
        socket.on("connect", () => socket?.emit("subscribe-outlet", { outletId }))
        socket.on("notification.created", (notification: AppNotification) => {
          invalidate()
          const isSelf = currentUserId !== undefined && notification.actorUserId === currentUserId
          if (isSelf && !TOAST_EVEN_IF_SELF.includes(notification.type)) {
            return
          }
          const variant = NOTIFICATION_TOAST_VARIANT[notification.type] ?? "info"
          toast[variant](notification.title, { description: notification.body ?? undefined })
        })
      })
      .catch(() => {
        // Realtime is a nice-to-have — the feed refetches on open anyway.
      })

    return () => {
      cancelled = true
      socket?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, currentUserId])
}
