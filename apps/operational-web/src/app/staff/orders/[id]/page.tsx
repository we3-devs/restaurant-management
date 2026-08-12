import { OrderDetail } from "@/app/(operational)/orders/[id]/order-detail"

/**
 * Staff-shell counterpart to (operational)/orders/[id] — shows order items and
 * customer/table details in read-only mode. Rendered under staff/layout.tsx's
 * mobile shell (StaffHeader/StaffTabBar) instead of (operational)/layout.tsx's
 * desktop sidebar chrome, so staff viewing an order doesn't get dropped into
 * the desktop nav. Payment management is restricted to POS terminals.
 */
export default async function StaffOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetail orderId={Number(id)} basePath="/staff" isReadOnly />
}
