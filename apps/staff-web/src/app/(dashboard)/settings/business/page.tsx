"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type BusinessSettings } from "@/hooks/use-settings"
import { businessSettingsSchema, type BusinessSettingsInput } from "@/lib/validators/settings"
import { usePageTitle } from "@rms/ui/use-page-title"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useOperatingHours, useUpdateOperatingHours } from "@rms/api-client/hooks/use-operating-hours"

const defaultValues: BusinessSettingsInput = {
  restaurantName: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  vatNumber: "",
  businessHours: "",
  timezone: "",
  currency: "",
  calendarSystem: "AD",
}

const CALENDAR_SYSTEMS = [
  { value: "AD", label: "AD (Gregorian)" },
  { value: "BS", label: "BS (Bikram Sambat)" },
] as const

export default function BusinessSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")
  const { outletId: activeOutletId } = useActiveOutlet()
  const { data: hours } = useOperatingHours(activeOutletId)
  const updateHours = useUpdateOperatingHours(activeOutletId)
  const [openingTime, setOpeningTime] = useState("")
  const [closingTime, setClosingTime] = useState("")
  const [hoursTimezone, setHoursTimezone] = useState("")
  const [hoursEnabled, setHoursEnabled] = useState(false)

  const { data, isLoading } = useSettingsCategory<BusinessSettings>("business")
  const showSkeleton = useDelayedLoading(isLoading)
  const updateSettings = useUpdateSettings<BusinessSettings>("business")

  const form = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  useEffect(() => {
    if (!hours) return
    setOpeningTime(hours.openingTime ?? "")
    setClosingTime(hours.closingTime ?? "")
    setHoursTimezone(hours.timezone)
    setHoursEnabled(hours.enabled)
  }, [hours])

  async function onSubmit(values: BusinessSettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Business settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  usePageTitle("Business Settings")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Business Settings</h1>

      {showSkeleton ? (
        <FormSkeleton fields={6} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="restaurantName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Restaurant name</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl type="email" disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT number</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessHours"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Business hours</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="calendarSystem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calendar system</FormLabel>
                      <Select value={field.value ?? "AD"} onValueChange={field.onChange} disabled={!canManage}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CALENDAR_SYSTEMS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

      <Card>
        <CardHeader><CardTitle>Outlet operating hours</CardTitle></CardHeader>
        <CardContent>
          {!activeOutletId ? <p className="text-sm text-muted-foreground">Select one outlet from the top navigation. Operating hours cannot be edited for All outlets.</p> : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Opening time<input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} disabled={!canManage} className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
              <label className="text-sm">Closing time<input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} disabled={!canManage} className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
              <label className="col-span-2 text-sm">IANA timezone<input value={hoursTimezone} onChange={(e) => setHoursTimezone(e.target.value)} disabled={!canManage} placeholder="Asia/Kathmandu" className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={hoursEnabled} onChange={(e) => setHoursEnabled(e.target.checked)} disabled={!canManage} /> Enforce operating hours</label>
              {canManage && <Button disabled={updateHours.isPending} onClick={async () => { try { await updateHours.mutateAsync({ openingTime, closingTime, timezone: hoursTimezone, enabled: hoursEnabled }); toast.success("Operating hours updated") } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update operating hours") } }}>Save operating hours</Button>}
              {hours && <p className="col-span-2 text-sm text-muted-foreground">Status: {hours.isOpen ? "Open" : "Closed"}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
