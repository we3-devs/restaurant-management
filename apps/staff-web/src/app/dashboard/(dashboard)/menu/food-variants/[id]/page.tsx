import { FoodVariantDetail } from "./food-variant-detail"

export default async function FoodVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FoodVariantDetail variantId={Number(id)} />
}
