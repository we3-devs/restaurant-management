import { AddonDetail } from "./addon-detail"

export default async function AddonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AddonDetail addonId={Number(id)} />
}
