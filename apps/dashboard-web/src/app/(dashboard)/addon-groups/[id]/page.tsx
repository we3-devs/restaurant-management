import { AddonGroupDetail } from "./addon-group-detail"

export default async function AddonGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AddonGroupDetail addonGroupId={Number(id)} />
}
