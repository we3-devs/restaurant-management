"use client"

import { useEffect, useState } from "react"

type PosterBranding = {
  restaurantName: string | null
  logoUrl: string | null
  primaryColor: string | null
  qrTemplateUrl: string | null
  qrTemplateQrX: number | null
  qrTemplateQrY: number | null
  qrTemplateQrSize: number | null
}

type BrandedQrPosterProps = {
  qrDataUrl: string
  tableLabel: string
  branding: PosterBranding
  downloadName?: string
  showDownload?: boolean
}

const TEMPLATE_WIDTH = 1200
const TEMPLATE_HEIGHT = 1600
const DEFAULT_QR_X = 300
const DEFAULT_QR_Y = 515
const DEFAULT_QR_SIZE = 600

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image: ${src}`))
    image.src = src
  })
}

export function BrandedQrPoster({
  qrDataUrl,
  tableLabel,
  branding,
  downloadName = "table-qr",
  showDownload = false,
}: BrandedQrPosterProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState(false)
  const hasTemplate = Boolean(branding.qrTemplateUrl)

  useEffect(() => {
    let cancelled = false
    setDownloadUrl(null)
    setTemplateError(false)

    if (!branding.qrTemplateUrl) return

    Promise.all([loadImage(qrDataUrl), loadImage(branding.qrTemplateUrl, true)])
      .then(([qr, template]) => {
        if (cancelled) return

        const canvas = document.createElement("canvas")
        canvas.width = TEMPLATE_WIDTH
        canvas.height = TEMPLATE_HEIGHT
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas is not available")

        const qrX = branding.qrTemplateQrX ?? DEFAULT_QR_X
        const qrY = branding.qrTemplateQrY ?? DEFAULT_QR_Y
        const qrSize = branding.qrTemplateQrSize ?? DEFAULT_QR_SIZE
        const quietZone = Math.max(20, Math.round(qrSize * 0.05))

        ctx.drawImage(template, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT)
        ctx.fillStyle = "#fff"
        ctx.fillRect(qrX - quietZone, qrY - quietZone, qrSize + quietZone * 2, qrSize + quietZone * 2)
        ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)

        const labelWidth = Math.min(360, Math.max(220, qrSize * 0.45))
        const labelHeight = Math.max(64, Math.round(labelWidth * 0.3))
        const labelX = qrX + (qrSize - labelWidth) / 2
        const labelY = qrY + qrSize + quietZone + 20
        ctx.fillStyle = "#202126"
        ctx.beginPath()
        ctx.roundRect(labelX, labelY, labelWidth, labelHeight, labelHeight / 2)
        ctx.fill()
        ctx.fillStyle = "#fff"
        ctx.font = `700 ${Math.max(24, Math.round(labelHeight * 0.42))}px Arial`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(tableLabel, qrX + qrSize / 2, labelY + labelHeight / 2)

        if (!cancelled) setDownloadUrl(canvas.toDataURL("image/png"))
      })
      .catch(() => {
        if (!cancelled) setTemplateError(true)
      })

    return () => {
      cancelled = true
    }
  }, [branding.qrTemplateQrSize, branding.qrTemplateQrX, branding.qrTemplateQrY, branding.qrTemplateUrl, qrDataUrl, tableLabel])

  return (
    <div className="flex flex-col items-center gap-3">
      {!hasTemplate ? (
        <div className="w-full max-w-[300px] rounded-xl border border-amber-300 bg-amber-50 p-5 text-center text-sm text-amber-900">
          QR template is not configured. Please contact an administrator.
        </div>
      ) : templateError ? (
        <div className="w-full max-w-[300px] rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center text-sm text-destructive">
          QR template could not be loaded. Please contact an administrator.
        </div>
      ) : downloadUrl ? (
        <img
          src={downloadUrl}
          width={300}
          height={400}
          alt={`Branded QR code for ${tableLabel}`}
          className="w-full max-w-[300px] rounded-xl border shadow-sm"
        />
      ) : (
        <div className="flex h-[400px] w-full max-w-[300px] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
          Preparing QR poster…
        </div>
      )}
      {showDownload && downloadUrl ? (
        <a href={downloadUrl} download={`${downloadName}.png`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
          Download branded QR
        </a>
      ) : null}
    </div>
  )
}
