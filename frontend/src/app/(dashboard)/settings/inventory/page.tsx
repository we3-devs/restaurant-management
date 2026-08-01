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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type InventorySettings } from "@/hooks/use-settings"
import {
  INVENTORY_NEGATIVE_STOCK_POLICIES,
  INVENTORY_STOCK_COSTING_METHODS,
  inventorySettingsSchema,
  type InventorySettingsInput,
} from "@/lib/validators/settings"

const defaultValues: InventorySettingsInput = {
  negativeStockPolicy: "block",
  autoReorder: false,
  lowStockThreshold: 0,
  stockCostingMethod: "fifo",
  stockPrecision: 0,
}

export default function InventorySettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<InventorySettings>("inventory")
  const updateSettings = useUpdateSettings<InventorySettings>("inventory")

  const form = useForm<InventorySettingsInput>({
    resolver: zodResolver(inventorySettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: InventorySettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Inventory settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Inventory Settings</h1>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stock policy</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="negativeStockPolicy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Negative stock policy</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVENTORY_NEGATIVE_STOCK_POLICIES.map((policy) => (
                            <SelectItem key={policy} value={policy}>
                              {policy}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockCostingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock costing method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVENTORY_STOCK_COSTING_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
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
                  name="stockPrecision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock precision (decimals)</FormLabel>
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
                  name="autoReorder"
                  render={({ field }) => (
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id="autoReorder"
                        checked={field.value}
                        disabled={!canManage}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor="autoReorder">Automatically raise reorder requests</Label>
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
