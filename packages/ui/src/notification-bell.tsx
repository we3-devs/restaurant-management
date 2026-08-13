"use client"

import { useState } from "react"
import Link from "next/link"
import { BellIcon, BellRingIcon, CheckCheckIcon, CheckCircle2Icon, DropletIcon, HandIcon, SoupIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "./badge"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Skeleton } from "./skeleton"
import { PushNotificationsBanner } from "./push-notifications-banner"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  type AppNotification,
} from "@rms/api-client/hooks/use-notifications"
import { cn } from "./cn"

function formatRelative(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

function NotificationIcon({ notification }: { notification: AppNotification }) {
  const className = "size-4 shrink-0 text-muted-foreground"
  switch (notification.type) {
    case "kitchen_ready":
      return <SoupIcon className={cn(className, "text-emerald-500")} />
    case "order_served":
      return <CheckCircle2Icon className={cn(className, "text-emerald-500")} />
    case "service_request":
      return notification.tableName ? <DropletIcon className={cn(className, "text-sky-500")} /> : <HandIcon className={cn(className, "text-sky-500")} />
    default:
      return <BellIcon className={className} />
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const currentUser = useCurrentUser()
  const { outletId: effectiveOutletId } = useActiveOutlet()

  // Only set up realtime updates if dropdown has been opened once (implies notifications are being used)
  useNotificationsRealtime(isOpen ? effectiveOutletId : null, currentUser.id)

  // Only fetch notifications when dropdown is open to defer from critical bootstrap path
  const { data, isLoading } = useNotifications({
    outletId: isOpen ? effectiveOutletId : null,
    limit: 25
  })
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead(effectiveOutletId)

  const notifications = data?.data ?? []
  const unreadCount = data?.unreadCount ?? 0

  async function handleMarkAll() {
    try {
      await markAll.mutateAsync()
      toast.success("All notifications marked as read")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update notifications")
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          >
            {unreadCount > 0 ? <BellRingIcon /> : <BellIcon />}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={6} className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheckIcon className="size-3" />
                Mark all read
              </button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="px-2 pb-1">
          <PushNotificationsBanner />
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-80 space-y-1 overflow-y-auto p-1">
          {isLoading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoading && notifications.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {effectiveOutletId ? "No notifications yet" : "Select an outlet to watch"}
            </p>
          )}
          {notifications.map((notification) => {
            const unread = !notification.readAt
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => unread && markRead.mutate(notification.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                  !unread && "opacity-60",
                )}
              >
                <NotificationIcon notification={notification} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm leading-tight", unread && "font-medium")}>
                    {notification.title}
                  </span>
                  {notification.body && (
                    <span className="block truncate text-xs text-muted-foreground">{notification.body}</span>
                  )}
                  <span className="block text-[11px] text-muted-foreground/70">
                    {formatRelative(notification.createdAt)}
                  </span>
                </span>
                {unread && <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">new</Badge>}
              </button>
            )
          })}
        </div>
        <DropdownMenuSeparator />
        <Link
          href="/notifications"
          className="block px-2 py-1.5 text-center text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
