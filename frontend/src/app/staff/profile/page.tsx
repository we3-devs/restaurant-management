"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { MyDeliveryPreferences } from "@/components/my-delivery-preferences"
import { APP_VERSION } from "@/lib/app-version"

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

export default function StaffProfilePage() {
  const user = useCurrentUser()

  return (
    <div className="space-y-4">
      <Card className="items-center gap-3 p-6 text-center">
        <Avatar size="lg">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {user.isSuperadmin && <Badge variant="secondary">Superadmin</Badge>}
      </Card>
      <Card className="gap-2 p-4">
        <p className="text-sm font-medium">Permissions</p>
        <div className="flex flex-wrap gap-1.5">
          {user.permissions.length === 0 && !user.isSuperadmin && (
            <p className="text-sm text-muted-foreground">No permissions assigned.</p>
          )}
          {user.permissions.map((slug) => (
            <Badge key={slug} variant="outline" className="text-xs">
              {slug}
            </Badge>
          ))}
        </div>
      </Card>
      <MyDeliveryPreferences />
      <p className="text-center text-xs text-muted-foreground">App version {APP_VERSION}</p>
    </div>
  )
}
