import { InvoiceView } from "@/app/(operational)/invoices/[id]/invoice-view"

/** Staff-shell counterpart to (operational)/invoices/[id] — same read-only invoice document, rendered under the mobile shell. */
export default async function StaffInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InvoiceView orderId={Number(id)} basePath="/staff" />
}
