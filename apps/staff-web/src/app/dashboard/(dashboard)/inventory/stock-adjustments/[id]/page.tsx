import { StockAdjustmentDetail } from "./stock-adjustment-detail"

export default async function StockAdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StockAdjustmentDetail adjustmentId={Number(id)} />
}
