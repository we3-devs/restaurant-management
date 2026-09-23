/**
 * One source of truth for where things sit on the 1200 × 1600 QR poster.
 *
 * The table label used to be welded to the QR — always centred under it, a
 * fixed gap below. Now it carries its own X/Y like the QR does, and those stay
 * nullable: a tenant who never moved the label keeps the old centred position
 * instead of having every printed poster shift under them.
 */

export const QR_TEMPLATE_WIDTH = 1200
export const QR_TEMPLATE_HEIGHT = 1600

export const QR_TEMPLATE_DEFAULTS = {
  qrX: 300,
  qrY: 515,
  qrSize: 600,
  tableWidth: 260,
  tableHeight: 80,
  tableFontSize: 34,
} as const

type Nullable = number | null | undefined

export type QrTemplateLayoutInput = {
  qrX?: Nullable
  qrY?: Nullable
  qrSize?: Nullable
  tableWidth?: Nullable
  tableHeight?: Nullable
  tableFontSize?: Nullable
  tableX?: Nullable
  tableY?: Nullable
}

export type QrTemplateLayout = {
  qrX: number
  qrY: number
  qrSize: number
  quietZone: number
  labelWidth: number
  labelHeight: number
  labelFontSize: number
  labelX: number
  labelY: number
}

const num = (value: Nullable, fallback: number) => (typeof value === "number" ? value : fallback)

export function resolveQrTemplateLayout(input: QrTemplateLayoutInput = {}): QrTemplateLayout {
  const qrX = num(input.qrX, QR_TEMPLATE_DEFAULTS.qrX)
  const qrY = num(input.qrY, QR_TEMPLATE_DEFAULTS.qrY)
  const qrSize = num(input.qrSize, QR_TEMPLATE_DEFAULTS.qrSize)
  const labelWidth = num(input.tableWidth, QR_TEMPLATE_DEFAULTS.tableWidth)
  const labelHeight = num(input.tableHeight, QR_TEMPLATE_DEFAULTS.tableHeight)
  const labelFontSize = num(input.tableFontSize, QR_TEMPLATE_DEFAULTS.tableFontSize)
  const quietZone = Math.max(20, Math.round(qrSize * 0.05))

  return {
    qrX,
    qrY,
    qrSize,
    quietZone,
    labelWidth,
    labelHeight,
    labelFontSize,
    labelX: num(input.tableX, qrX + (qrSize - labelWidth) / 2),
    labelY: num(input.tableY, qrY + qrSize + quietZone + 20),
  }
}
