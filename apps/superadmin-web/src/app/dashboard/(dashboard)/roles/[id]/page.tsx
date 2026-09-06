import { RoleDetail } from "./role-detail"

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoleDetail roleId={Number(id)} />
}
