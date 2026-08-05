"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { Skeleton } from "./skeleton"
import {
  useNotificationPreferences,
  usePushPublicKey,
  useSubscribePush,
  useUnsubscribePush,
  useUpdateNotificationPreferences,
} from "@rms/api-client/hooks/use-notifications"
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "@rms/api-client/realtime/push-subscribe"

/**
 * Per-user email/SMS/push opt-in — shared by the desktop notification
 * settings page and the staff mobile profile page (both need the same
 * push-subscribe flow; splitting it out here keeps the staff bundle from
 * pulling in the desktop settings form's react-hook-form/zod tree).
 */
export function MyDeliveryPreferences() {
  const { data: preferences, isLoading } = useNotificationPreferences()
  const { data: pushKey } = usePushPublicKey()
  const updatePreferences = useUpdateNotificationPreferences()
  const subscribePush = useSubscribePush()
  const unsubscribePush = useUnsubscribePush()
  const [pushBusy, setPushBusy] = useState(false)

  async function toggle(field: "emailEnabled" | "smsEnabled" | "pushEnabled", checked: boolean) {
    try {
      if (field === "pushEnabled" && checked) {
        await enablePush()
        return
      }
      if (field === "pushEnabled" && !checked) {
        await disablePush()
        return
      }
      await updatePreferences.mutateAsync({ [field]: checked })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update preference")
    }
  }

  async function enablePush() {
    if (!isPushSupported()) {
      toast.error("Push notifications aren't supported in this browser")
      return
    }
    if (!pushKey?.publicKey) {
      toast.error("Push notifications aren't configured on the server yet")
      return
    }
    setPushBusy(true)
    try {
      const subscription = await subscribeToPush(pushKey.publicKey)
      const keys = subscription.keys
      if (!subscription.endpoint || !keys?.p256dh || !keys.auth) {
        throw new Error("Browser did not return a usable push subscription")
      }
      await subscribePush.mutateAsync({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth })
      await updatePreferences.mutateAsync({ pushEnabled: true })
      toast.success("Push notifications enabled on this device")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable push notifications")
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    try {
      const endpoint = await unsubscribeFromPush()
      if (endpoint) await unsubscribePush.mutateAsync(endpoint)
      await updatePreferences.mutateAsync({ pushEnabled: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disable push notifications")
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My delivery preferences</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="myEmailEnabled"
                checked={preferences?.emailEnabled ?? false}
                onCheckedChange={(checked) => toggle("emailEnabled", checked === true)}
              />
              <Label htmlFor="myEmailEnabled">Email me</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mySmsEnabled"
                checked={preferences?.smsEnabled ?? false}
                onCheckedChange={(checked) => toggle("smsEnabled", checked === true)}
              />
              <Label htmlFor="mySmsEnabled">Text me (SMS)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="myPushEnabled"
                checked={preferences?.pushEnabled ?? false}
                disabled={pushBusy}
                onCheckedChange={(checked) => toggle("pushEnabled", checked === true)}
              />
              <Label htmlFor="myPushEnabled">Push notifications on this device</Label>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          These control whether *you* also get an email/SMS/push alert in addition to the in-app feed. Requires
          admin-level channels above to be configured and enabled server-side.
        </p>
      </CardContent>
    </Card>
  )
}
