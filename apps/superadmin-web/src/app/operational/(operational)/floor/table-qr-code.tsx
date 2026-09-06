"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

import { Skeleton } from "@rms/ui/skeleton"

/** Renders the guest self-ordering QR for a table, linking into this app's own /guest?table= page. */
export function TableQrCode({ value, size = 176 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        // Failed to render — nothing sensible to fall back to here.
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <Skeleton style={{ width: size, height: size }} className="rounded-lg" />
  }

  return <img src={dataUrl} width={size} height={size} alt={`QR code: ${value}`} className="rounded-lg border" />
}
