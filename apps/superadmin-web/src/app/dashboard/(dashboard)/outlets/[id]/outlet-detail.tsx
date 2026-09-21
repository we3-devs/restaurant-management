"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useDeleteOutlet, useOutlet, useUpdateOutlet } from "@/hooks/use-outlets"
import { updateOutletSchema, type UpdateOutletInput } from "@/lib/validators/outlets"
import { usePageTitle } from "@rms/ui/use-page-title"
import { useCurrentUser } from "@/lib/auth/current-user-context"

export function OutletDetail({ outletId }: { outletId: number }) {
  const router = useRouter()
  const user = useCurrentUser()
  const { data: outlet, isLoading } = useOutlet(outletId)
  const showSkeleton = useDelayedLoading(isLoading)
  const updateOutlet = useUpdateOutlet(outletId)
  const deleteOutlet = useDeleteOutlet()

  const form = useForm<UpdateOutletInput>({
    resolver: zodResolver(updateOutletSchema),
    defaultValues: { name: "", qrOrderingMode: "login", qrAccessCheckMode: "either" },
  })

  useEffect(() => {
    if (outlet) {
      form.reset({
        name: outlet.name,
        qrOrderingMode: outlet.qrOrderingMode,
        qrAccessCheckMode: outlet.qrAccessCheckMode,
        qrAccessLatitude: outlet.qrAccessLatitude ?? undefined,
        qrAccessLongitude: outlet.qrAccessLongitude ?? undefined,
        qrAccessRadiusMeters: outlet.qrAccessRadiusMeters ?? undefined,
        qrAccessAllowedIp: outlet.qrAccessAllowedIp ?? "",
      })
    }
  }, [outlet, form])

  const qrOrderingMode = form.watch("qrOrderingMode")
  const qrAccessCheckMode = form.watch("qrAccessCheckMode")
  const needsIp = qrAccessCheckMode === "ip" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both"
  const needsGeofence = qrAccessCheckMode === "geofence" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both"

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available in this browser")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("qrAccessLatitude", pos.coords.latitude, { shouldDirty: true })
        form.setValue("qrAccessLongitude", pos.coords.longitude, { shouldDirty: true })
      },
      () => toast.error("Couldn't get your current location"),
    )
  }

  async function onSubmit(values: UpdateOutletInput) {
    try {
      await updateOutlet.mutateAsync({
        ...values,
        qrAccessAllowedIp: values.qrAccessAllowedIp || undefined,
      })
      toast.success("Outlet updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update outlet")
    }
  }

  async function handleDelete() {
    try {
      await deleteOutlet.mutateAsync(outletId)
      toast.success("Outlet deleted")
      router.push("/dashboard/outlets")
    } catch (error) {
      // 409 (departments/warehouses/orders/etc. still reference it) surfaces the backend's message here.
      toast.error(error instanceof Error ? error.message : "Failed to delete outlet")
    }
  }

  usePageTitle("Outlet Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !outlet) return <NotFoundCard resource="Outlet" />
  if (!outlet) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{outlet.name}</h1>
        {user.isSuperadmin && !outlet.slug.startsWith("deleted-") && <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete outlet &quot;{outlet.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                The outlet and its historical records will be preserved. Its slug will be replaced with a
                random slug so the original slug can be reused.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
      </div>

      {user.isSuperadmin ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Ordering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="qrOrderingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="login">Customer Login</SelectItem>
                          <SelectItem value="quick_order">Quick Order (No Login)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Customer Login requires phone OTP verification. Quick Order skips sign-in
                        entirely, gated instead by the access checks below.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {qrOrderingMode === "quick_order" && (
                  <>
                    <FormField
                      control={form.control}
                      name="qrAccessCheckMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access check</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a check" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ip">IP only</SelectItem>
                              <SelectItem value="geofence">Geofence only</SelectItem>
                              <SelectItem value="either">Either</SelectItem>
                              <SelectItem value="both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {needsGeofence && (
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Geofence</p>
                          <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                            Use my current location
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="qrAccessLatitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Latitude</FormLabel>
                                <FormControl
                                  type="number"
                                  step="any"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="qrAccessLongitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Longitude</FormLabel>
                                <FormControl
                                  type="number"
                                  step="any"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="qrAccessRadiusMeters"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Radius (meters)</FormLabel>
                              <FormControl
                                type="number"
                                min={1}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                              />
                              <FormDescription>e.g. 200 for roughly the restaurant's footprint</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {needsIp && (
                      <FormField
                        control={form.control}
                        name="qrAccessAllowedIp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Allowed IP</FormLabel>
                            <FormControl {...field} value={field.value ?? ""} />
                            <FormDescription>
                              The restaurant's public-facing WAN IP, not a LAN address (e.g. not 192.168.x.x).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Button type="submit" disabled={updateOutlet.isPending}>
              {updateOutlet.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </Form>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Only an admin can edit this outlet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
