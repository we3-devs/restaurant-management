import { ReceiptView } from "@/app/operational/(operational)/pos/receipt/[orderId]/receipt-view"

/** Staff-shell counterpart to (operational)/pos/receipt/[orderId] — same ReceiptView, kept inside the mobile shell instead of the desktop one. */
export default async function StaffReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return <ReceiptView orderId={Number(orderId)} />
}
