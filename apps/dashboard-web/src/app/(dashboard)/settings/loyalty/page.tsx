"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type LoyaltySettings } from "@/hooks/use-settings"
import { loyaltySettingsSchema, type LoyaltySettingsInput } from "@/lib/validators/settings"

const defaultValues: LoyaltySettingsInput = {
  pointsPerCurrencyUnit: 0,
  minRedemptionPoints: 0,
  maxRedemptionPercent: 0,
  pointExpiryDays: 0,
  welcomeBonusPoints: 0,
  birthdayBonusPoints: 0,
}

export default function LoyaltySettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<LoyaltySettings>("loyalty")
  const showSkeleton = useDelayedLoading(isLoading)
  const updateSettings = useUpdateSettings<LoyaltySettings>("loyalty")

  const form = useForm<LoyaltySettingsInput>({
    resolver: zodResolver(loyaltySettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: LoyaltySettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Loyalty settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Loyalty Settings</h1>

      {showSkeleton ? (
        <FormSkeleton fields={4} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Points program</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="pointsPerCurrencyUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Points per currency unit</FormLabel>
                      <FormControl
                        type="number"
                        step="0.01"
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
                  name="minRedemptionPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum redemption points</FormLabel>
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
                  name="maxRedemptionPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max redemption %</FormLabel>
                      <FormControl
                        type="number"
                        step="0.01"
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
                  name="pointExpiryDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Point expiry (days)</FormLabel>
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
                  name="welcomeBonusPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Welcome bonus points</FormLabel>
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
                  name="birthdayBonusPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birthday bonus points</FormLabel>
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
    </div>
  )
}
