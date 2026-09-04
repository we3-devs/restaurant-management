import { StockInDetail } from "./stock-in-detail"

export default async function StockInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StockInDetail stockInId={Number(id)} />
}
