"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { Card } from "@rms/ui/card"
import { StatGridSkeleton } from "@rms/ui/skeletons"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useKdsBootstrap } from "@rms/api-client/hooks/use-kitchen-tickets"
import { ticketStage } from "@rms/api-client/kitchen/ticket-stage"
import { STAFF_NAV_ITEMS, canSeeStaffNavItem } from "./nav-items"

/** Landing page — renders a tile per module the signed-in user's permissions actually unlock, instead of guessing one to redirect into. */
export default function StaffLandingPage() {
  const user = useCurrentUser()
  const { outletId } = useActiveOutlet()
  const visibleItems = STAFF_NAV_ITEMS.filter((item) => canSeeStaffNavItem(item, user))

  // Same gating as the Tables/Kitchen tiles below — only fetched (and only
  // shown) when the user actually holds the permission that screen requires,
  // so this never fires a request or shows a number for data they can't open.
  const canSeeTables = user.isSuperadmin || user.permissions.includes("dining-tables.view")
  const canSeeKitchen = user.isSuperadmin || user.permissions.includes("kitchen-tickets.manage")

  const { data: occupiedTables, isLoading: tablesLoading } = useDiningTables(
    { outletId: outletId ?? undefined, status: "occupied", limit: 1 },
    { enabled: canSeeTables && !!outletId },
  )
  const kds = useKdsBootstrap(canSeeKitchen ? outletId : null)
  const statsLoading =
    (canSeeTables && !!outletId && tablesLoading) || (canSeeKitchen && !!outletId && (kds.isLoading ?? false))

  const stats = [
    canSeeTables && { label: "Occupied tables", value: occupiedTables?.meta.total },
    canSeeKitchen && {
      label: "Pending tickets",
      value: kds.data?.tickets.filter((ticket) => ticketStage(ticket) !== "ready").length,
    },
  ].filter((stat): stat is { label: string; value: number | undefined } => !!stat)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Hi, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">What do you need to do?</p>
      </div>

      {outletId && stats.length > 0 &&
        (statsLoading ? (
          <StatGridSkeleton count={stats.length} className="grid-cols-2" />
        ) : (
        <div className={`grid gap-3 ${stats.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {stats.map((stat) => (
            <Card key={stat.label} className="gap-1 rounded-xl border-border/60 p-4 shadow-none">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{stat.value ?? "—"}</p>
            </Card>
          ))}
        </div>
        ))}

      {visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your account doesn&apos;t have access to any staff modules yet — ask an admin to grant you a role.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="flex">
                <Card className="flex-row items-center gap-4 rounded-xl border-border/60 p-4 shadow-none transition-colors active:bg-muted hover:bg-muted/50">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{item.label}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{item.description}</p>
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
