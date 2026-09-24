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
  qrTemplateTableWidth: 260,
  qrTemplateTableFontSize: 34,
  qrTemplateTableTextColor: "#ffffff",
  qrTemplateTableX: null,
  qrTemplateTableY: null,
}

/**
 * The two label position fields are nullable on purpose: blank means "sit
 * centred under the QR", which is where the label lived before it could be
 * moved, so a poster nobody has retouched keeps printing exactly as it did.
 */
const QR_TEMPLATE_FIELDS = [
  { name: "qrTemplateQrX", label: "QR X position", min: 0, max: 1200, nullable: false },
  { name: "qrTemplateQrY", label: "QR Y position", min: 0, max: 1600, nullable: false },
  { name: "qrTemplateQrSize", label: "QR size", min: 128, max: 900, nullable: false },
  { name: "qrTemplateTableWidth", label: "Table label width", min: 120, max: 600, nullable: false },
  { name: "qrTemplateTableFontSize", label: "Table label font size", min: 16, max: 120, nullable: false },
  { name: "qrTemplateTableX", label: "Table label X position", min: 0, max: 1200, nullable: true },
  { name: "qrTemplateTableY", label: "Table label Y position", min: 0, max: 1600, nullable: true },
] as const

export default function AppearanceSettingsPage() {
  const { permissions } = useCurrentUser()
  const canView = permissions.includes("settings.view")
  const canManage = permissions.includes("settings.manage")

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
  const qrTemplateTableWidth = form.watch("qrTemplateTableWidth")
  const qrTemplateTableFontSize = form.watch("qrTemplateTableFontSize")
  const qrTemplateTableTextColor = form.watch("qrTemplateTableTextColor")
  const qrTemplateTableX = form.watch("qrTemplateTableX")
  const qrTemplateTableY = form.watch("qrTemplateTableY")

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
                {QR_TEMPLATE_FIELDS.map((qrField) => (
                  <FormField
                    key={qrField.name}
                    control={form.control}
                    name={qrField.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{qrField.label}</FormLabel>
                        <FormControl
                          type="number"
                          min={qrField.min}
                          max={qrField.max}
                          placeholder={qrField.nullable ? "Auto (centred under QR)" : undefined}
                          disabled={!canManage}
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? qrField.nullable
                                  ? null
                                  : undefined
                                : Number(event.target.value),
                            )
                          }
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="qrTemplateTableTextColor"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Table label text color</FormLabel>
                      <ColorPickerField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={!canManage}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 border-t pt-3">
                  <QrTemplatePreview
                    templateUrl={qrTemplateUrl}
                    qrX={qrTemplateQrX}
                    qrY={qrTemplateQrY}
                    qrSize={qrTemplateQrSize}
                    tableWidth={qrTemplateTableWidth}
                    tableFontSize={qrTemplateTableFontSize}
                    tableTextColor={qrTemplateTableTextColor}
                    tableX={qrTemplateTableX}
                    tableY={qrTemplateTableY}
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
