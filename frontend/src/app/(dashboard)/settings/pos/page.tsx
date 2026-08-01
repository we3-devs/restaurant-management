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
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type PosSettings } from "@/hooks/use-settings"
import { posSettingsSchema, type PosSettingsInput } from "@/lib/validators/settings"

const defaultValues: PosSettingsInput = {
  receiptPrefix: "",
  receiptFooter: "",
  receiptHeader: "",
  autoPrint: false,
  serviceChargePercent: 0,
  defaultTaxPercent: 0,
  defaultPaymentMethod: "",
}

export default function PosSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<PosSettings>("pos")
  const updateSettings = useUpdateSettings<PosSettings>("pos")

  const form = useForm<PosSettingsInput>({
    resolver: zodResolver(posSettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: PosSettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("POS settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">POS Settings</h1>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Receipts and defaults</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="receiptPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt prefix</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultPaymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default payment method</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiptHeader"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Receipt header</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiptFooter"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Receipt footer</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceChargePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service charge %</FormLabel>
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
                  name="defaultTaxPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default tax %</FormLabel>
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
                  name="autoPrint"
                  render={({ field }) => (
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id="autoPrint"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="autoPrint">Auto-print receipts</Label>
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
