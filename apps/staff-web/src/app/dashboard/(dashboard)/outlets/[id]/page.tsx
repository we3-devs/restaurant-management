import { OutletDetail } from "./outlet-detail"

export default async function OutletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OutletDetail outletId={Number(id)} />
}
