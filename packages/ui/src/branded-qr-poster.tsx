"use client"

import { useEffect, useState } from "react"

type PosterBranding = {
  restaurantName: string | null
  logoUrl: string | null
  primaryColor: string | null
}

type BrandedQrPosterProps = {
  qrDataUrl: string
  tableLabel: string
  branding: PosterBranding
  downloadName?: string
  showDownload?: boolean
}

const FALLBACK_COLOR = "#f7c500"
const FOOTER_COLOR = "#202126"
const RESTRA_LOGO_URL = "/icons/logo.png"

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number) {
  let current = size
  while (current > 18) {
    ctx.font = `700 ${current}px Arial`
    if (ctx.measureText(text).width <= maxWidth) break
    current -= 2
  }
  return current
}

export function BrandedQrPoster({
  qrDataUrl,
  tableLabel,
  branding,
  downloadName = "table-qr",
  showDownload = false,
}: BrandedQrPosterProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const name = branding.restaurantName?.trim() || "Our Restaurant"
  const color = branding.primaryColor || FALLBACK_COLOR

  useEffect(() => {
    let cancelled = false
    const canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 1600
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const qr = new Image()
    const logo = branding.logoUrl ? new Image() : null
    const restraLogo = new Image()
    qr.onload = () => {
      const draw = () => {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (logo?.complete && logo.naturalWidth) {
          const ratio = Math.min(180 / logo.naturalWidth, 120 / logo.naturalHeight)
          ctx.drawImage(logo, 80, 70, logo.naturalWidth * ratio, logo.naturalHeight * ratio)
        }
        ctx.fillStyle = "#202126"
        ctx.textAlign = "center"
        ctx.font = `700 ${fitText(ctx, name, 940, 58)}px Arial`
        ctx.fillText(name, 600, 150)
        ctx.font = "700 38px Arial"
        ctx.fillText("SCAN TO", 600, 275)
        ctx.font = "800 78px Arial"
        ctx.fillText("View Our Menu", 600, 360)
        ctx.font = "500 38px Arial"
        ctx.fillText("Scan  •  Order  •  Enjoy", 600, 425)

        ctx.fillStyle = "#fff"
        ctx.fillRect(270, 485, 660, 660)
        ctx.drawImage(qr, 300, 515, 600, 600)

        ctx.fillStyle = FOOTER_COLOR
        ctx.beginPath()
        ctx.roundRect(470, 1170, 260, 80, 40)
        ctx.fill()
        ctx.fillStyle = "#fff"
        ctx.font = "700 34px Arial"
        ctx.fillText(tableLabel, 600, 1222)

        ctx.fillStyle = FOOTER_COLOR
        ctx.fillRect(0, 1260, canvas.width, 340)
        ctx.fillStyle = "#fff"
        ctx.font = "500 30px Arial"
        ctx.fillText("Powered by:", 600, 1360)

        if (restraLogo.complete && restraLogo.naturalWidth) {
          ctx.drawImage(restraLogo, 365, 1380, 72, 72)
        }
        ctx.fillStyle = color
        ctx.font = "800 48px Arial"
        ctx.fillText("RESTRA SERVICES", 710, 1430)
        ctx.fillStyle = "#fff"
        ctx.font = "400 24px Arial"
        ctx.fillText("restraservices.com", 600, 1515)
        if (!cancelled) setDownloadUrl(canvas.toDataURL("image/png"))
      }
      const drawWhenReady = () => {
        if ((logo && !logo.complete) || !restraLogo.complete) return
        draw()
      }
      if (logo && !logo.complete) logo.onload = drawWhenReady
      restraLogo.onload = drawWhenReady
      drawWhenReady()
    }
    qr.src = qrDataUrl
    if (logo) {
      logo.crossOrigin = "anonymous"
      logo.src = branding.logoUrl!
    }
    restraLogo.src = RESTRA_LOGO_URL
    return () => {
      cancelled = true
    }
  }, [branding.logoUrl, color, name, qrDataUrl, tableLabel])

  return (
    <div className="flex flex-col items-center gap-3">
      {downloadUrl ? (
        <img
          src={downloadUrl}
          width={300}
          height={400}
          alt={`Branded QR code for ${tableLabel}`}
          className="w-full max-w-[300px] rounded-xl border shadow-sm"
        />
      ) : (
        <div className="flex h-[400px] w-full max-w-[300px] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
          Preparing branded QR…
        </div>
      )}
      {/*
      <div className="w-full max-w-[300px] overflow-hidden rounded-xl border shadow-sm" style={{ backgroundColor: color }}>
        <div className="relative px-4 pb-5 pt-5 text-center text-[#202126]">
          {branding.logoUrl ? <img src={branding.logoUrl} alt="" className="mx-auto mb-2 h-12 max-w-32 object-contain" /> : null}
          <p className="truncate text-lg font-bold">{name}</p>
          <p className="mt-5 text-xs font-bold tracking-[0.25em]">SCAN TO</p>
          <p className="text-2xl font-black">View Our Menu</p>
          <p className="text-sm font-medium">Scan · Order · Enjoy</p>
          <div className="mx-auto mt-5 w-fit rounded-lg bg-white p-4">
            <img src={qrDataUrl} width={190} height={190} alt={`QR code for ${tableLabel}`} className="block" />
          </div>
          <p className="mx-auto mt-3 w-fit rounded-full bg-[#202126] px-5 py-1.5 text-sm font-bold text-white">{tableLabel}</p>
        </div>
        <div className="bg-[#202126] px-3 pb-5 pt-4 text-center text-white">
          <p className="text-xs text-white/75">Powered by:</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <img src={RESTRA_LOGO_URL} alt="" className="size-8 object-contain" />
            <p className="text-sm font-black tracking-widest" style={{ color }}>RESTRA SERVICES</p>
          </div>
          <a
            href="https://restraservices.com"
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-[10px] text-white underline-offset-2 hover:underline"
          >
            restraservices.com
          </a>
        </div>
      </div> */}
      {showDownload && downloadUrl ? (
        <a href={downloadUrl} download={`${downloadName}.png`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
          Download branded QR
        </a>
      ) : null}
    </div>
  )
}
