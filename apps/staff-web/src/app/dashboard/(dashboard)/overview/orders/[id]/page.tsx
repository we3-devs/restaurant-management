import { OrderTrackingDetail } from "./order-tracking-detail"

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderTrackingDetail orderId={Number(id)} />
}
