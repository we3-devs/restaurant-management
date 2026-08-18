"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { FormSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type NotificationSettings } from "@/hooks/use-settings"
import { MyDeliveryPreferences } from "@/components/my-delivery-preferences"
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
  const showSkeleton = useDelayedLoading(isLoading)
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

      {showSkeleton ? (
        <FormSkeleton fields={5} />
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
