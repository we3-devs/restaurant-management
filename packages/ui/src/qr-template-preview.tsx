"use client"

import { QrCodeIcon } from "lucide-react"

import {
  QR_TEMPLATE_DEFAULTS,
  QR_TEMPLATE_HEIGHT,
  QR_TEMPLATE_WIDTH,
  resolveQrTemplateLayout,
  type QrTemplateLayout,
} from "./qr-template-layout"

type QrTemplatePreviewProps = {
  templateUrl?: string
  qrX?: number
  qrY?: number
  qrSize?: number
  tableWidth?: number
  tableHeight?: number
  tableFontSize?: number
  tableX?: number | null
  tableY?: number | null
}

const WIDTH = QR_TEMPLATE_WIDTH
const HEIGHT = QR_TEMPLATE_HEIGHT

function formatTableLabel() {
  return "1"
}

function downloadBlankTemplate(layout: QrTemplateLayout) {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const { qrX, qrY, qrSize, quietZone, labelWidth, labelHeight, labelFontSize, labelX, labelY } = layout

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
  ctx.fillText("QR CODE GOES HERE", qrX + qrSize / 2, qrY + qrSize / 2)
  ctx.font = "400 24px Arial"
  ctx.fillText(`${qrSize} × ${qrSize}px`, qrX + qrSize / 2, qrY + qrSize / 2 + 42)

  ctx.fillStyle = "#202126"
  ctx.beginPath()
  ctx.roundRect(labelX, labelY, labelWidth, labelHeight, labelHeight / 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = `700 ${labelFontSize}px Arial`
  ctx.fillText(formatTableLabel(), labelX + labelWidth / 2, labelY + labelHeight / 2)

  const link = document.createElement("a")
  link.href = canvas.toDataURL("image/png")
  link.download = "qr-template-1200x1600.png"
  link.click()
}

export function QrTemplatePreview({
  templateUrl,
  qrX = QR_TEMPLATE_DEFAULTS.qrX,
  qrY = QR_TEMPLATE_DEFAULTS.qrY,
  qrSize = QR_TEMPLATE_DEFAULTS.qrSize,
  tableWidth = QR_TEMPLATE_DEFAULTS.tableWidth,
  tableHeight = QR_TEMPLATE_DEFAULTS.tableHeight,
  tableFontSize = QR_TEMPLATE_DEFAULTS.tableFontSize,
  tableX,
  tableY,
}: QrTemplatePreviewProps) {
  const scale = 300 / WIDTH
  const layout = resolveQrTemplateLayout({ qrX, qrY, qrSize, tableWidth, tableHeight, tableFontSize, tableX, tableY })
  const { quietZone, labelWidth, labelHeight, labelX, labelY } = layout

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
            left: labelX * scale,
            top: labelY * scale,
            width: labelWidth * scale,
            height: labelHeight * scale,
            fontSize: tableFontSize * scale,
          }}
        >
          {formatTableLabel()}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Canvas: 1200 × 1600px · QR: X {qrX}, Y {qrY}, Size {qrSize}px · Table label: X {Math.round(labelX)}, Y{" "}
        {Math.round(labelY)}
      </p>
      <button
        type="button"
        onClick={() => downloadBlankTemplate(layout)}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
      >
        Download blank template
      </button>
    </div>
  )
}
