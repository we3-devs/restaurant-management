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
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type AppearanceSettings } from "@/hooks/use-settings"
import { appearanceSettingsSchema, type AppearanceSettingsInput } from "@/lib/validators/settings"

const defaultValues: AppearanceSettingsInput = {
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  receiptBrandingText: "",
}

export default function AppearanceSettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const canManage = isSuperadmin || permissions.includes("settings.manage")

  const { data, isLoading } = useSettingsCategory<AppearanceSettings>("appearance")
  const updateSettings = useUpdateSettings<AppearanceSettings>("appearance")

  const form = useForm<AppearanceSettingsInput>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues,
  })

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

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Appearance Settings</h1>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
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
