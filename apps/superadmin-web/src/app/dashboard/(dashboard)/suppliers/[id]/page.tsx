import { SupplierDetail } from "./supplier-detail"

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SupplierDetail supplierId={Number(id)} />
}
