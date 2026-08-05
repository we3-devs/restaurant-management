import { TableSessionDetail } from "./table-session-detail"

export default async function TableSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TableSessionDetail sessionId={Number(id)} />
}
