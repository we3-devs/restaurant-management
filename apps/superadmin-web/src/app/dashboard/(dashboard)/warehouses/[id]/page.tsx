import { WarehouseDetail } from "./warehouse-detail"

export default async function WarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WarehouseDetail warehouseId={Number(id)} />
}
