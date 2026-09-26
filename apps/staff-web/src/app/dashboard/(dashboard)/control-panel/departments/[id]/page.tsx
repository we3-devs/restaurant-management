import { OutletDepartmentDetail } from "./outlet-department-detail"

export default async function OutletDepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OutletDepartmentDetail departmentId={Number(id)} />
}
