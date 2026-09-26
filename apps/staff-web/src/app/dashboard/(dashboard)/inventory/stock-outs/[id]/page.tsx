import { StockOutDetail } from "./stock-out-detail"

export default async function StockOutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StockOutDetail stockOutId={Number(id)} />
}
