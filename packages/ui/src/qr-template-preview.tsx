"use client"

import { QrCodeIcon } from "lucide-react"

type QrTemplatePreviewProps = {
  templateUrl?: string
  qrX?: number
  qrY?: number
  qrSize?: number
}

const WIDTH = 1200
const HEIGHT = 1600

function downloadBlankTemplate(qrX: number, qrY: number, qrSize: number) {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const quietZone = Math.max(20, Math.round(qrSize * 0.05))
  const labelWidth = Math.min(360, Math.max(220, qrSize * 0.45))
  const labelHeight = Math.max(64, Math.round(labelWidth * 0.3))
  const labelX = qrX + (qrSize - labelWidth) / 2
  const labelY = qrY + qrSize + quietZone + 20

  ctx.fillStyle = "#f7c500"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = "#202126"
  ctx.textAlign = "center"
  ctx.font = "700 38px Arial"
  ctx.fillText("YOUR QR POSTER TEMPLATE", WIDTH / 2, 100)
  ctx.font = "400 24px Arial"
  ctx.fillText("Design around the reserved QR area", WIDTH / 2, 145)

  ctx.fillStyle = "#fff"
  ctx.fillRect(qrX - quietZone, qrY - quietZone, qrSize + quietZone * 2, qrSize + quietZone * 2)
  ctx.strokeStyle = "#64748b"
  ctx.setLineDash([14, 12])
  ctx.lineWidth = 4
  ctx.strokeRect(qrX - quietZone, qrY - quietZone, qrSize + quietZone * 2, qrSize + quietZone * 2)
  ctx.setLineDash([])
  ctx.fillStyle = "#64748b"
  ctx.font = "700 32px Arial"
  ctx.fillText("QR CODE GOES HERE", WIDTH / 2, qrY + qrSize / 2)
  ctx.font = "400 24px Arial"
  ctx.fillText(`${qrSize} × ${qrSize}px`, WIDTH / 2, qrY + qrSize / 2 + 42)

  ctx.fillStyle = "#202126"
  ctx.beginPath()
  ctx.roundRect(labelX, labelY, labelWidth, labelHeight, labelHeight / 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = "700 30px Arial"
  ctx.fillText("TABLE NAME", WIDTH / 2, labelY + labelHeight / 2 + 10)

  const link = document.createElement("a")
  link.href = canvas.toDataURL("image/png")
  link.download = "qr-template-1200x1600.png"
  link.click()
}

export function QrTemplatePreview({
  templateUrl,
  qrX = 300,
  qrY = 515,
  qrSize = 600,
}: QrTemplatePreviewProps) {
  const scale = 300 / WIDTH
  const quietZone = Math.max(20, Math.round(qrSize * 0.05))
  const labelWidth = Math.min(360, Math.max(220, qrSize * 0.45))
  const labelHeight = Math.max(64, Math.round(labelWidth * 0.3))

  return (
    <div className="space-y-2">
      <div
        className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-xl border bg-[#f7c500] bg-cover bg-center shadow-sm"
        style={templateUrl ? { backgroundImage: `url(${JSON.stringify(templateUrl)})` } : undefined}
      >
        {!templateUrl && (
          <div className="absolute inset-0 bg-[#f7c500] p-5 text-center text-[#202126]">
            <p className="mt-3 text-[9px] font-bold tracking-[0.18em]">YOUR QR POSTER TEMPLATE</p>
            <p className="mt-1 text-sm font-black">Leave this area blank</p>
          </div>
        )}
        <div
          className="absolute flex items-center justify-center border-2 border-dashed border-slate-500 bg-white/95 text-center text-[10px] font-semibold text-slate-600"
          style={{
            left: (qrX - quietZone) * scale,
            top: (qrY - quietZone) * scale,
            width: (qrSize + quietZone * 2) * scale,
            height: (qrSize + quietZone * 2) * scale,
          }}
        >
          <span className="flex flex-col items-center gap-1">
            <QrCodeIcon className="size-7" />
            QR CODE
            <span className="text-[8px] font-normal">{qrSize} × {qrSize}px</span>
          </span>
        </div>
        <div
          className="absolute flex items-center justify-center rounded-full bg-[#202126] text-[10px] font-bold text-white"
          style={{
            left: (qrX + (qrSize - labelWidth) / 2) * scale,
            top: (qrY + qrSize + quietZone + 20) * scale,
            width: labelWidth * scale,
            height: labelHeight * scale,
          }}
        >
          Table name
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Canvas: 1200 × 1600px · QR: X {qrX}, Y {qrY}, Size {qrSize}px
      </p>
      <button
        type="button"
        onClick={() => downloadBlankTemplate(qrX, qrY, qrSize)}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
      >
        Download blank template
      </button>
    </div>
  )
}
