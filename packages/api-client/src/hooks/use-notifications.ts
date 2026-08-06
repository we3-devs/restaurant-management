import { useEffect } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "../client"
import { acquireKdsSocket, releaseKdsSocket } from "../realtime/kds-socket"
import { playNotificationChime } from "../realtime/notification-sound"
import { queryKeys } from "../query-keys"
import { toQueryString, type PaginatedResponse } from "../types"
import {
  NOTIFICATION_TOAST_VARIANT,
  TOAST_EVEN_IF_SELF,
  type NotificationPriority,
  type NotificationType,
} from "@rms/validators/notifications"

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
    // Safety net for the (rare) case the /kds socket in
    // useNotificationsRealtime never connects or drops silently — without
    // this, the bell only ever refreshes on mount (refetchOnWindowFocus/
    // refetchOnReconnect are both off globally, see query-provider.tsx).
    refetchInterval: 60_000,
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

    const socket = acquireKdsSocket()
    const subscribe = () => socket.emit("subscribe-outlet", { outletId })
    const onNotificationCreated = (notification: AppNotification) => {
      invalidate()
      const isSelf = currentUserId !== undefined && notification.actorUserId === currentUserId
      if (isSelf && !TOAST_EVEN_IF_SELF.includes(notification.type)) {
        return
      }
      playNotificationChime()
      const variant = NOTIFICATION_TOAST_VARIANT[notification.type] ?? "info"
      toast[variant](notification.title, { description: notification.body ?? undefined })
    }

    socket.on("connect", subscribe)
    socket.on("notification.created", onNotificationCreated)
    if (socket.connected) subscribe()

    return () => {
      socket.off("connect", subscribe)
      socket.off("notification.created", onNotificationCreated)
      releaseKdsSocket()
    }
    // invalidate's identity changes every render (useInvalidateNotifications
    // isn't memoized) — omitted deliberately so this effect only re-runs on
    // an actual outlet/user change, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, currentUserId])
}
