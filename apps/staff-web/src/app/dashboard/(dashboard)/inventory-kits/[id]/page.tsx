import { InventoryKitDetail } from "./inventory-kit-detail"

export default async function InventoryKitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InventoryKitDetail kitId={Number(id)} />
}
