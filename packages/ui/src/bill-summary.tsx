/**
 * The one subtotal/discount/grand-total/paid/due breakdown used everywhere
 * an order's bill is summarized — checkout, table checkout, order detail,
 * invoices, and order tracking all render this instead of each keeping its
 * own copy of the same grid, so a change to what a bill shows only has to
 * happen once.
 */
export function BillSummary({
  order,
  className = "grid grid-cols-2 gap-y-1 text-sm",
}: {
  order: {
    subtotal: number
    discountAmount: number
    grandTotal: number
    paidAmount: number
    dueAmount: number
  }
  className?: string
}) {
  return (
    <div className={className}>
      <span className="text-muted-foreground">Subtotal</span>
      <span className="text-right">{order.subtotal}</span>
      <span className="text-muted-foreground">Discount</span>
      <span className="text-right">-{order.discountAmount}</span>
      <span className="font-medium">Grand total</span>
      <span className="text-right font-medium">{order.grandTotal}</span>
      <span className="text-muted-foreground">Paid</span>
      <span className="text-right">{order.paidAmount}</span>
      <span className="font-medium">Due</span>
      <span className="text-right font-medium">{order.dueAmount}</span>
    </div>
  )
}
