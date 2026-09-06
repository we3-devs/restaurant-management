import { FoodCategoryDetail } from "./food-category-detail"

export default async function FoodCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FoodCategoryDetail categoryId={Number(id)} />
}
