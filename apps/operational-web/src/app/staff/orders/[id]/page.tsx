import { OrderDetail } from "@/app/(operational)/orders/[id]/order-detail"

/**
 * Staff-shell counterpart to (operational)/orders/[id] — same OrderDetail
 * component (order items, payment summary/refunds, history), just rendered
 * under staff/layout.tsx's mobile shell (StaffHeader/StaffTabBar) instead of
 * (operational)/layout.tsx's desktop sidebar chrome, so a cashier tapping an
 * order from /staff/orders doesn't get dropped into the desktop nav.
 */
export default async function StaffOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetail orderId={Number(id)} basePath="/staff" />
}
