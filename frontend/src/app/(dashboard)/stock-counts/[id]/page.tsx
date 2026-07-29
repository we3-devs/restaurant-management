import { StockCountDetail } from "./stock-count-detail"

export default async function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StockCountDetail countId={Number(id)} />
}
