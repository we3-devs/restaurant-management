"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ColorPickerField } from "@/components/ui/color-picker-field"
import { ImageUploadField } from "@/components/ui/image-upload-field"
import { FormSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type AppearanceSettings } from "@/hooks/use-settings"
import { appearanceSettingsSchema, type AppearanceSettingsInput } from "@/lib/validators/settings"
import { usePageTitle } from "@rms/ui/use-page-title"
import { QrTemplatePreview } from "@rms/ui/qr-template-preview"

const defaultValues: AppearanceSettingsInput = {
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  receiptBrandingText: "",
  qrTemplateUrl: "",
  qrTemplateQrX: 300,
  qrTemplateQrY: 515,
  qrTemplateQrSize: 600,
}

export default function AppearanceSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<AppearanceSettings>("appearance")
  const showSkeleton = useDelayedLoading(isLoading)
  const updateSettings = useUpdateSettings<AppearanceSettings>("appearance")

  const form = useForm<AppearanceSettingsInput>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues,
  })
  const qrTemplateUrl = form.watch("qrTemplateUrl")
  const qrTemplateQrX = form.watch("qrTemplateQrX")
  const qrTemplateQrY = form.watch("qrTemplateQrY")
  const qrTemplateQrSize = form.watch("qrTemplateQrSize")

  useEffect(() => {
    if (data) {
      form.reset({ ...defaultValues, ...data })
    }
  }, [data, form])

  async function onSubmit(values: AppearanceSettingsInput) {
    try {
      await updateSettings.mutateAsync(values)
      toast.success("Appearance settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings")
    }
  }

  usePageTitle("Appearance Settings")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Appearance Settings</h1>

      {showSkeleton ? (
        <FormSkeleton fields={5} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Logo</FormLabel>
                      <ImageUploadField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canManage}
                        hint="Shown in the sidebar and on the guest ordering app."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="faviconUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Favicon</FormLabel>
                      <ImageUploadField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canManage}
                        hint="Browser tab icon. A square PNG of 32×32 or larger works best."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Primary color</FormLabel>
                      <ColorPickerField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canManage}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiptBrandingText"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Receipt branding text</FormLabel>
                      <FormControl disabled={!canManage} {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 border-t pt-3">
                  <p className="text-sm font-semibold">QR poster template</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload a 1200×1600 PNG template. QR posters will not render until a template is configured.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="qrTemplateUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>QR template</FormLabel>
                      <ImageUploadField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canManage}
                        hint="Use a 1200×1600 PNG and leave a clear white area for the QR code."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(["qrTemplateQrX", "qrTemplateQrY", "qrTemplateQrSize"] as const).map((fieldName) => (
                  <FormField
                    key={fieldName}
                    control={form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fieldName === "qrTemplateQrX" ? "QR X position" : fieldName === "qrTemplateQrY" ? "QR Y position" : "QR size"}</FormLabel>
                        <FormControl
                          type="number"
                          min={fieldName === "qrTemplateQrSize" ? 128 : 0}
                          max={fieldName === "qrTemplateQrX" ? 1200 : fieldName === "qrTemplateQrY" ? 1600 : 900}
                          disabled={!canManage}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value === "" ? undefined : Number(event.target.value))}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <div className="col-span-2 border-t pt-3">
                  <QrTemplatePreview
                    templateUrl={qrTemplateUrl}
                    qrX={qrTemplateQrX}
                    qrY={qrTemplateQrY}
                    qrSize={qrTemplateQrSize}
                  />
                </div>
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
