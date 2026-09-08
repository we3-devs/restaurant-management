"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

import { Skeleton } from "@/components/ui/skeleton"
import { useBranding } from "@rms/api-client/hooks/use-branding"
import { BrandedQrPoster } from "@rms/ui/branded-qr-poster"

/** Same rendering as `@/components/qr-code`'s QrCode, but keeps the data URL around so it can offer a download. */
export function DownloadableQrCode({ value, fileName, tableLabel, size = 176 }: { value: string; fileName: string; tableLabel: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const branding = useBranding()

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        // Failed to render — the caller should still offer the plain link.
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <Skeleton style={{ width: size, height: size }} className="rounded-lg" />
  }

  return <BrandedQrPoster qrDataUrl={dataUrl} tableLabel={tableLabel} branding={branding} downloadName={fileName} showDownload />
}
