import { DiningTableDetail } from "./dining-table-detail"

export default async function DiningTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DiningTableDetail tableId={Number(id)} />
}
