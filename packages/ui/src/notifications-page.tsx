"use client"

import { useState } from "react"
import { ArchiveIcon, ArchiveRestoreIcon, BellOffIcon, CheckIcon, Trash2Icon } from "lucide-react"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

import { Badge } from "./badge"
import { Button } from "./button"
import { Card } from "./card"
import { Input } from "./input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Skeleton } from "./skeleton"
import { DataTablePagination } from "./data-table-pagination"
import {
  useArchiveNotification,
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
  useUnarchiveNotification,
  type AppNotification,
} from "@rms/api-client/hooks/use-notifications"
import {
  NOTIFICATION_CATEGORY_GROUPS,
  NOTIFICATION_PRIORITIES,
} from "@rms/validators/notifications"
import { cn } from "./cn"

const PAGE_SIZE = 20

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

const PRIORITY_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  normal: "secondary",
  high: "outline",
  urgent: "destructive",
}

export function NotificationsPage() {
  const { outletId: effectiveOutletId, outlets } = useActiveOutlet()

  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<string>("all")
  const [priority, setPriority] = useState<string>("all")
  const [readFilter, setReadFilter] = useState<string>("all")
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState("")

  const categoryTypes = category !== "all" ? NOTIFICATION_CATEGORY_GROUPS[category] : undefined

  const { data, isLoading, isPlaceholderData } = useNotifications({
    outletId: effectiveOutletId,
    page,
    limit: PAGE_SIZE,
    priority: priority !== "all" ? (priority as never) : undefined,
    read: readFilter === "read" ? true : readFilter === "unread" ? false : undefined,
    archived,
    search: search || undefined,
  })

  const markRead = useMarkNotificationRead()
  const archive = useArchiveNotification()
  const unarchive = useUnarchiveNotification()
  const remove = useDeleteNotification()

  // Category maps to multiple `type` values server-side isn't supported by a
  // single query param, so when a category is picked we filter client-side
  // on the already-fetched page — good enough for a moderate-volume feed.
  const notifications = (data?.data ?? []).filter(
    (n) => !categoryTypes || categoryTypes.includes(n.type),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          {outlets.find((o) => o.id === effectiveOutletId)?.name ?? "No outlet selected"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48 space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <Select value={category} onValueChange={(v) => { setCategory(v ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.keys(NOTIFICATION_CATEGORY_GROUPS).map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <Select value={priority} onValueChange={(v) => { setPriority(v ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {NOTIFICATION_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <Select value={readFilter} onValueChange={(v) => { setReadFilter(v ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Read/unread" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search title or body..."
          />
        </div>
        <Button
          variant={archived ? "default" : "outline"}
          onClick={() => { setArchived((v) => !v); setPage(1) }}
        >
          {archived ? "Showing archived" : "Show archived"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <BellOffIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No notifications found</p>
          <p className="text-sm text-muted-foreground">Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className={cn("space-y-2", isPlaceholderData && "opacity-60 transition-opacity")}>
          {notifications.map((notification: AppNotification) => {
            const unread = !notification.readAt
            const isArchived = !!notification.archivedAt
            return (
              <Card key={notification.id} className={cn("flex flex-row items-start justify-between gap-3 p-3", unread && "border-primary/40")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", unread && "font-semibold")}>{notification.title}</p>
                    <Badge variant={PRIORITY_VARIANT[notification.priority]}>{notification.priority}</Badge>
                    <Badge variant="outline">{notification.type}</Badge>
                    {unread && <Badge>unread</Badge>}
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {unread && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Mark read"
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      <CheckIcon />
                    </Button>
                  )}
                  {isArchived ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Unarchive"
                      onClick={() => unarchive.mutate(notification.id)}
                    >
                      <ArchiveRestoreIcon />
                    </Button>
                  ) : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Archive"
                      onClick={() => archive.mutate(notification.id)}
                    >
                      <ArchiveIcon />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => remove.mutate(notification.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {data && <DataTablePagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />}
    </div>
  )
}
