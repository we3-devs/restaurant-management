"use client"

import { useState } from "react"
import { ImageUploadField } from "@/components/ui/image-upload-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, useUpdateSettings, type AppearanceSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function AssetsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("settings.manage")
  const { data } = useSettingsCategory<AppearanceSettings>("appearance")
  const updateSettings = useUpdateSettings<AppearanceSettings>("appearance")
  const [logoUrl, setLogoUrl] = useState<string | undefined>()
  const [faviconUrl, setFaviconUrl] = useState<string | undefined>()

  const currentLogo = logoUrl ?? data?.logoUrl ?? ""
  const currentFavicon = faviconUrl ?? data?.faviconUrl ?? ""

  async function save() {
    try {
      await updateSettings.mutateAsync({ logoUrl: currentLogo, faviconUrl: currentFavicon })
      toast.success("Assets saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save assets")
    }
  }

  usePageTitle("Assets")

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">Upload and manage this restaurant&apos;s branding images.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Logo</p>
            <ImageUploadField
              value={currentLogo}
              onChange={setLogoUrl}
              disabled={!canManage}
              hint="PNG, JPEG, WebP, GIF or ICO up to 2MB."
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Favicon</p>
            <ImageUploadField
              value={currentFavicon}
              onChange={setFaviconUrl}
              disabled={!canManage}
              hint="A square PNG or ICO works best."
            />
          </div>
          {canManage && <Button type="button" onClick={() => void save()} disabled={updateSettings.isPending}>{updateSettings.isPending ? "Saving..." : "Save assets"}</Button>}
          {!canManage && <p className="text-sm text-muted-foreground">You can view assets, but need settings management access to upload them.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
