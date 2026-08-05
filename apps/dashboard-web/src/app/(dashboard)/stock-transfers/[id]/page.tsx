import { StockTransferDetail } from "./stock-transfer-detail"

export default async function StockTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StockTransferDetail transferId={Number(id)} />
}
