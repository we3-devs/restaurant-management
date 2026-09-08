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
    </div>
  )
}
