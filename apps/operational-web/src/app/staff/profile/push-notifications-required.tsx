"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BellIcon, BellOffIcon, BellRingIcon, CheckIcon } from "lucide-react"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import {
  usePushPublicKey,
  useSubscribePush,
  useUpdateNotificationPreferences,
} from "@rms/api-client/hooks/use-notifications"
import { isPushSupported, subscribeToPush } from "@rms/api-client/realtime/push-subscribe"

type PushStatus = "checking" | "unsupported" | "prompt" | "enabling" | "enabled" | "denied" | "error"

async function hasExistingSubscription(): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js")
  const subscription = await registration?.pushManager.getSubscription()
  return !!subscription
}

/**
 * Push is no longer opt-in for staff (see profile page redesign) — order/
 * kitchen alerts need to reach the device they're working on, so this
 * enforces a subscription instead of offering a checkbox. Still needs one
 * user click to satisfy the browser's permission-prompt gesture requirement
 * when permission hasn't been decided yet; once granted it silently
 * re-confirms the subscription (and the server-side pushEnabled flag) on
 * every visit without bothering the user again.
 */
export function PushNotificationsRequired() {
  const { data: pushKey } = usePushPublicKey()
  const subscribePush = useSubscribePush()
  const updatePreferences = useUpdateNotificationPreferences()
  const [status, setStatus] = useState<PushStatus>("checking")

  const enable = useCallback(async () => {
    if (!pushKey?.publicKey) {
      toast.error("Push notifications aren't configured on the server yet")
      setStatus("error")
      return
    }
    setStatus("enabling")
    try {
      const subscription = await subscribeToPush(pushKey.publicKey)
      const keys = subscription.keys
      if (!subscription.endpoint || !keys?.p256dh || !keys.auth) {
        throw new Error("Browser did not return a usable push subscription")
      }
      await subscribePush.mutateAsync({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth })
      await updatePreferences.mutateAsync({ pushEnabled: true })
      setStatus("enabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable push notifications")
      setStatus(Notification.permission === "denied" ? "denied" : "error")
    }
  }, [pushKey, subscribePush, updatePreferences])

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) {
        setStatus("unsupported")
        return
      }
      if (!pushKey) return // wait for the VAPID key before deciding anything

      if (Notification.permission === "denied") {
        setStatus("denied")
        return
      }

      if (Notification.permission === "default") {
        setStatus("prompt")
        return
      }

      // Already granted — re-confirm silently (no click, no permission
      // prompt) instead of always re-subscribing over the network.
      if (await hasExistingSubscription()) {
        await updatePreferences.mutateAsync({ pushEnabled: true }).catch(() => {})
        setStatus("enabled")
      } else {
        await enable()
      }
    })()
    // Only re-run this on a genuine key/support change, not on every
    // updatePreferences/enable identity change (those are new every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushKey])

  return (
    <Card className="gap-3 rounded-2xl border-border/60 p-4 shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRingIcon className="size-4 text-primary" />
          <p className="text-sm font-medium">Push notifications</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Required
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Order and kitchen alerts are delivered to this device via push — it can&apos;t be turned off.
      </p>

      {status === "checking" && <p className="text-sm text-muted-foreground">Checking this device…</p>}

      {status === "enabled" && (
        <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="size-4" />
          Enabled on this device
        </div>
      )}

      {status === "prompt" && (
        <Button onClick={() => void enable()} className="w-full">
          <BellIcon />
          Enable push notifications
        </Button>
      )}

      {status === "enabling" && (
        <Button disabled className="w-full">
          <BellIcon />
          Enabling…
        </Button>
      )}

      {status === "denied" && (
        <div className="flex items-start gap-1.5 text-sm text-destructive">
          <BellOffIcon className="mt-0.5 size-4 shrink-0" />
          Blocked in this browser. Allow notifications for this site in your browser settings, then reload.
        </div>
      )}

      {status === "unsupported" && (
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <BellOffIcon className="mt-0.5 size-4 shrink-0" />
          This browser doesn&apos;t support push notifications.
        </div>
      )}

      {status === "error" && (
        <Button variant="outline" onClick={() => void enable()} className="w-full">
          Retry
        </Button>
      )}
    </Card>
  )
}
