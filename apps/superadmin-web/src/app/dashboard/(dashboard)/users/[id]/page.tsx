import { UserDetail } from "./user-detail"

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <UserDetail userId={Number(id)} />
}
