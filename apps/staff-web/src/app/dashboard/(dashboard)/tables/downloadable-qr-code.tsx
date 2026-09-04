"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Same rendering as `@/components/qr-code`'s QrCode, but keeps the data URL around so it can offer a download. */
export function DownloadableQrCode({ value, fileName, size = 176 }: { value: string; fileName: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={dataUrl} width={size} height={size} alt={`QR code: ${value}`} className="rounded-lg border" />
      <Button variant="outline" size="sm" render={<a href={dataUrl} download={`${fileName}.png`} />}>
        Download QR
      </Button>
    </div>
  )
}
