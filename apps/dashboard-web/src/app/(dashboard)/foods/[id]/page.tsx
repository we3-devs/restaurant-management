import { FoodDetail } from "./food-detail"

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FoodDetail foodId={Number(id)} />
}
