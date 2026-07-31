import { ReceiptView } from "./receipt-view"

export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <ReceiptView orderId={Number(orderId)} />
}
