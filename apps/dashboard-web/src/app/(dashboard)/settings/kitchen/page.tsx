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
import { useSettingsCategory, useUpdateSettings, type KitchenSettings } from "@/hooks/use-settings"
import { kitchenSettingsSchema, type KitchenSettingsInput } from "@/lib/validators/settings"
import { usePageTitle } from "@rms/ui/use-page-title"

const defaultValues: KitchenSettingsInput = {
  ticketTimeoutMinutes: 0,
  defaultPriority: "",
  autoRouting: false,
  recallLimit: 0,
  preparationTimerMinutes: 0,
}

export default function KitchenSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<KitchenSettings>("kitchen")
  const showSkeleton = useDelayedLoading(isLoading)
  const updateSettings = useUpdateSettings<KitchenSettings>("kitchen")

  const form = useForm<KitchenSettingsInput>({
    resolver: zodResolver(kitchenSettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: KitchenSettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Kitchen settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  usePageTitle("Kitchen Settings")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Kitchen Settings</h1>

      {showSkeleton ? (
        <FormSkeleton fields={5} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ticket handling</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="ticketTimeoutMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticket timeout (minutes)</FormLabel>
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
                  name="defaultPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default priority</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recallLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recall limit</FormLabel>
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
                  name="preparationTimerMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preparation timer (minutes)</FormLabel>
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
                  name="autoRouting"
                  render={({ field }) => (
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id="autoRouting"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="autoRouting">Automatically route tickets to stations</Label>
                    </div>
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
    </div>
  )
}
