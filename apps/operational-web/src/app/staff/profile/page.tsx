"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LogOutIcon, MailIcon, ShieldCheckIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@rms/ui/avatar"
import { Card } from "@rms/ui/card"
import { SettingsRow, SettingsRowGroup } from "@rms/ui/settings-row"
import { DarkModeRow } from "@rms/ui/dark-mode-row"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { APP_VERSION } from "@/lib/app-version"
import { apiClient } from "@rms/api-client/client"
import { AttendanceQrScanner } from "@/components/attendance-qr-scanner"

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

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}

export default function StaffProfilePage() {
  const user = useCurrentUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState("Checking attendance status…")

  useEffect(() => {
    const token = searchParams.get("attendanceToken")
    if (!token) {
      void apiClient<{ id: number } | null>("/attendance/me")
        .then((current) => setAttendanceMessage(current ? "Present — clocked in" : "Not present — scan the clock-in QR"))
        .catch(() => setAttendanceMessage("Unable to check attendance"))
      return
    }
    void apiClient("/attendance/qr/scan", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setAttendanceMessage("Attendance updated successfully"))
      .catch((error: Error) => setAttendanceMessage(error.message || "Attendance scan failed"))
      .finally(() => router.replace("/staff/profile"))
  }, [router, searchParams])

  const roleLabel = user.isSuperadmin
    ? "Superadmin"
    : user.roleSlugs.length > 0
      ? user.roleSlugs.map(titleCase).join(", ")
      : "No role assigned"

  async function handleLogout() {
    setIsLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-full flex-1 flex-col space-y-4">
      <Card className="gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
        <div className="h-28 bg-linear-to-br from-accent via-accent to-primary/20" />
        <div className="flex flex-col items-center gap-1 px-6 pb-6">
          <Avatar className="-mt-14 size-24 bg-linear-to-br from-primary/25 to-primary/5 ring-4 ring-card">
            <AvatarFallback className="bg-transparent text-2xl font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <p className="mt-2 text-xl font-semibold leading-tight">{user.name}</p>
        </div>

        <div className="divide-y divide-border border-t border-border/60">
          <SettingsRow icon={ShieldCheckIcon} label="Role" trailing={<span className="text-sm text-muted-foreground">{roleLabel}</span>} />
          <SettingsRow icon={MailIcon} label="Mail" trailing={<span className="text-sm text-muted-foreground">{user.email}</span>} />
        </div>
      </Card>

      <SettingsRowGroup>
        <AttendanceQrScanner onComplete={() => setAttendanceMessage("Present — attendance updated")} />
      </SettingsRowGroup>

      <SettingsRowGroup>
        <SettingsRow icon={ShieldCheckIcon} label="Attendance" trailing={<span className="text-sm text-muted-foreground">{attendanceMessage}</span>} />
      </SettingsRowGroup>

      <SettingsRowGroup>
        <DarkModeRow />
      </SettingsRowGroup>

      <div className="mt-auto space-y-3">
        <SettingsRowGroup>
          <SettingsRow
            icon={LogOutIcon}
            label={isLoggingOut ? "Logging out…" : "Log out"}
            destructive
            onClick={handleLogout}
            disabled={isLoggingOut}
          />
        </SettingsRowGroup>

        <p className="text-center text-xs text-muted-foreground">App version {APP_VERSION}</p>
      </div>
    </div>
  )
}
