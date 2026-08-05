import { DiningAreaDetail } from "./dining-area-detail"

export default async function DiningAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DiningAreaDetail areaId={Number(id)} />
}
