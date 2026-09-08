"use client"

import Link from "next/link"
import { ArrowUpRightIcon, CheckCircle2Icon, ChevronRightIcon, Clock3Icon, MapPinIcon } from "lucide-react"

import { Card } from "@rms/ui/card"
import { StatGridSkeleton } from "@rms/ui/skeletons"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useKdsBootstrap } from "@rms/api-client/hooks/use-kitchen-tickets"
import { ticketStage } from "@rms/api-client/kitchen/ticket-stage"
import { STAFF_NAV_ITEMS, canSeeStaffNavItem } from "./nav-items"

export default function StaffLandingPage() {
  const user = useCurrentUser()
  const { outletId, outlets, isLoadingOutlets } = useActiveOutlet()
  const outletName = outlets.find((outlet) => outlet.id === outletId)?.name
  const visibleItems = STAFF_NAV_ITEMS.filter((item) => canSeeStaffNavItem(item, user))
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
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-sm sm:px-7 sm:py-8">
        <div className="absolute -right-12 -top-20 size-56 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-24 right-16 size-48 rounded-full border-[28px] border-white/5" aria-hidden />
        <div className="relative">
          <div className="mb-5 flex items-center gap-2 text-sm text-primary-foreground/75">
            <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
              <Clock3Icon className="size-4" aria-hidden />
            </span>
            <span>Today&apos;s operations</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good to see you, {user.name.split(" ")[0]}.</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-primary-foreground/75">
            Keep the floor moving and stay on top of the next task.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <CheckCircle2Icon className="size-3.5" aria-hidden /> Service center ready
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <MapPinIcon className="size-3.5" aria-hidden />
              {isLoadingOutlets ? "Loading outlet" : outletName ?? "No outlet selected"}
            </span>
          </div>
        </div>
      </section>

      {outletId && stats.length > 0 &&
        (statsLoading ? (
          <StatGridSkeleton count={stats.length} className="grid-cols-2" />
        ) : (
          <div className={`grid gap-3 ${stats.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {stats.map((stat) => (
              <Card key={stat.label} className="relative gap-1 overflow-hidden rounded-2xl border-border/60 p-4 shadow-none">
                <div className="absolute right-4 top-4 size-9 rounded-full bg-primary/10" aria-hidden />
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{stat.value ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">At this outlet right now</p>
              </Card>
            ))}
          </div>
        ))}

      {visibleItems.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-6 text-center shadow-none">
          <p className="font-medium">No staff modules available</p>
          <p className="mt-1 text-sm text-muted-foreground">Ask an admin to grant you a role with operational access.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Quick access</p>
              <p className="text-sm text-muted-foreground">Jump into your service tools.</p>
            </div>
            <ArrowUpRightIcon className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="group flex">
                  <Card className="flex w-full flex-row items-center gap-3 rounded-2xl border-border/60 p-4 shadow-none transition-all group-active:scale-[.99] group-hover:border-primary/40 group-hover:bg-primary/[.03]">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{item.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
