"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BellIcon, BellOffIcon } from "lucide-react"

import { Button } from "./button"
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
 * Compact "enable push" prompt for the notification bell dropdown — replaces
 * the old dedicated card on the profile page. Only renders when this device
 * actually needs the user to act (a permission prompt or a blocked/failed
 * subscription); silent once push is enabled, same as before.
 */
export function PushNotificationsBanner({ app = "operational" }: { app?: "operational" | "dashboard" }) {
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
      await subscribePush.mutateAsync({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth, app })
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

  if (status === "checking" || status === "enabled" || status === "unsupported" || status === "enabling") {
    return null
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2">
      {status === "denied" ? (
        <>
          <BellOffIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs text-muted-foreground">
            Notifications are blocked in this browser. Allow them for this site in your browser settings, then reload.
          </p>
        </>
      ) : (
        <>
          <BellIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs text-muted-foreground">Enable push notifications to get alerts on this device.</p>
            <Button size="sm" className="h-7 text-xs" onClick={() => void enable()}>
              Enable
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
