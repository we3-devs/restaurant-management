"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

/**
 * Renders a QR code from a text/URL as an inline <img>. Used by the Floor
 * table dialog so staff can print/open a guest QR card linking to /guest.
 */
export function QrCode({ value, size = 112 }: { value: string; size?: number }) {
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
    return (
      <div
        className="animate-pulse rounded-lg bg-muted"
        style={{ width: size, height: size }}
        aria-label="Loading QR code"
      />
    )
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code: ${value}`}
      className="rounded-lg"
    />
  )
}
