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
import { useSettingsCategory, useUpdateSettings, type PosSettings } from "@/hooks/use-settings"
import { posSettingsSchema, type PosSettingsInput } from "@/lib/validators/settings"

const BILL_NUMBER_RESET_PERIODS = ["never", "daily", "monthly", "yearly"] as const

const defaultValues: PosSettingsInput = {
  receiptPrefix: "",
  receiptFooter: "",
  receiptHeader: "",
  autoPrint: false,
  serviceChargePercent: 0,
  defaultTaxPercent: 0,
  defaultPaymentMethod: "",
  billNumberDigits: 4,
  billNumberResetPeriod: "daily",
  invoicePrefix: "",
  invoiceNumberDigits: 4,
  invoiceNumberResetPeriod: "daily",
}

/** Illustrative only — mirrors OrdersService#generateBillNumber's format, not its actual sequence (which needs a real order count). */
function formatBillNumberPreview(
  prefix: string | undefined,
  digits: number | undefined,
  resetPeriod: string | undefined,
): string {
  const now = new Date()
  const sequence = "1".padStart(digits || 4, "0")
  const periodTag =
    resetPeriod === "daily"
      ? now.toISOString().slice(0, 10).replace(/-/g, "")
      : resetPeriod === "monthly"
        ? now.toISOString().slice(0, 7).replace("-", "")
        : resetPeriod === "yearly"
          ? String(now.getFullYear())
          : ""
  const parts = [prefix || "BILL", periodTag, sequence].filter(Boolean)
  return parts.join("-")
}

/** Illustrative only — mirrors OrdersService#generateInvoiceNumber's format. */
function formatInvoiceNumberPreview(
  prefix: string | undefined,
  digits: number | undefined,
  resetPeriod: string | undefined,
): string {
  const now = new Date()
  const sequence = "1".padStart(digits || 4, "0")
  const periodTag =
    resetPeriod === "daily"
      ? now.toISOString().slice(0, 10).replace(/-/g, "")
      : resetPeriod === "monthly"
        ? now.toISOString().slice(0, 7).replace("-", "")
        : resetPeriod === "yearly"
          ? String(now.getFullYear())
          : ""
  const parts = [prefix || "INV", periodTag, sequence].filter(Boolean)
  return parts.join("-")
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
                      <FormLabel>Bill number prefix</FormLabel>
                      <FormControl disabled={!canManage} placeholder="BILL" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billNumberDigits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill number digits</FormLabel>
                      <FormControl
                        type="number"
                        step="1"
                        min="1"
                        disabled={!canManage}
                        value={field.value ?? 4}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billNumberResetPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill number resets</FormLabel>
                      <Select
                        value={field.value ?? "daily"}
                        onValueChange={field.onChange}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILL_NUMBER_RESET_PERIODS.map((period) => (
                            <SelectItem key={period} value={period}>
                              {period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="col-span-2 text-xs text-muted-foreground">
                  Preview: {formatBillNumberPreview(form.watch("receiptPrefix"), form.watch("billNumberDigits"), form.watch("billNumberResetPeriod"))}
                </p>

                {/* Invoice Settings */}
                <hr className="col-span-2" />
                <h3 className="col-span-2 font-semibold text-sm">Invoice Settings</h3>
                <FormField
                  control={form.control}
                  name="invoicePrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice number prefix</FormLabel>
                      <FormControl disabled={!canManage} placeholder="INV" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumberDigits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice number digits</FormLabel>
                      <FormControl
                        type="number"
                        step="1"
                        min="1"
                        disabled={!canManage}
                        value={field.value ?? 4}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumberResetPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice number resets</FormLabel>
                      <Select
                        value={field.value ?? "daily"}
                        onValueChange={field.onChange}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILL_NUMBER_RESET_PERIODS.map((period) => (
                            <SelectItem key={period} value={period}>
                              {period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="col-span-2 text-xs text-muted-foreground">
                  Preview: {formatInvoiceNumberPreview(form.watch("invoicePrefix"), form.watch("invoiceNumberDigits"), form.watch("invoiceNumberResetPeriod"))}
                </p>

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
