"use client"

import { useState } from "react"
import { Button } from "@rms/ui/button"
import { useCurrentUser } from "@rms/auth/current-user-context"

/** A one-shot, mutation-specific override action. It never stores a bypass state. */
export function ClosedHoursOverrideButton({
  closed,
  label,
  onConfirm,
  disabled,
}: {
  closed: boolean
  label: string
  onConfirm: () => Promise<void>
  disabled?: boolean
}) {
  const { isSuperadmin } = useCurrentUser()
  const [pending, setPending] = useState(false)
  if (!closed || !isSuperadmin) return null

  async function handleClick() {
    if (!window.confirm(`Override closed hours for ${label}? This action will be audited.`)) return
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={disabled || pending}>
      {pending ? "Overriding..." : `Override: ${label}`}
    </Button>
  )
}
