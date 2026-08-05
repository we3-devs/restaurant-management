"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { Card } from "@rms/ui/card"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { STAFF_NAV_ITEMS, canSeeStaffNavItem } from "./nav-items"

/** Landing page — renders a tile per module the signed-in user's permissions actually unlock, instead of guessing one to redirect into. */
export default function StaffLandingPage() {
  const user = useCurrentUser()
  const visibleItems = STAFF_NAV_ITEMS.filter((item) => canSeeStaffNavItem(item, user))

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Hi, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">What do you need to do?</p>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your account doesn&apos;t have access to any staff modules yet — ask an admin to grant you a role.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Card className="flex-row items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
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
