import { PurchaseOrderDetail } from "./purchase-order-detail"

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PurchaseOrderDetail purchaseOrderId={Number(id)} />
}
