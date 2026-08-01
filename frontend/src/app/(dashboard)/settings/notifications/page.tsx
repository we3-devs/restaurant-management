"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type NotificationSettings } from "@/hooks/use-settings"
import {
  useNotificationPreferences,
  usePushPublicKey,
  useSubscribePush,
  useUnsubscribePush,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notifications"
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/realtime/push-subscribe"
import { notificationSettingsSchema, type NotificationSettingsInput } from "@/lib/validators/settings"

const defaultValues: NotificationSettingsInput = {
  enableEmail: false,
  enableSms: false,
  enablePush: false,
  lowStockThreshold: 0,
  kitchenDelayThresholdMinutes: 0,
  reservationReminderMinutesBefore: 0,
}

export default function NotificationSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<NotificationSettings>("notification")
  const updateSettings = useUpdateSettings<NotificationSettings>("notification")

  const form = useForm<NotificationSettingsInput>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: NotificationSettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Notification settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Notification Settings</h1>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Alert channels and thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="enableEmail"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableEmail"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="enableEmail">Enable email notifications</Label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enableSms"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableSms"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="enableSms">Enable SMS notifications</Label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enablePush"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enablePush"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="enablePush">Enable push notifications</Label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low stock threshold</FormLabel>
                      <FormControl
                        type="number"
                        disabled={!canManage}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kitchenDelayThresholdMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kitchen delay threshold (minutes)</FormLabel>
                      <FormControl
                        type="number"
                        disabled={!canManage}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reservationReminderMinutesBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reservation reminder (minutes before)</FormLabel>
                      <FormControl
                        type="number"
                        disabled={!canManage}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {canManage && (
                  <div className="col-span-2">
                    <Button type="submit" disabled={updateSettings.isPending}>
                      {updateSettings.isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <MyDeliveryPreferences />
    </div>
  )
}

function MyDeliveryPreferences() {
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
