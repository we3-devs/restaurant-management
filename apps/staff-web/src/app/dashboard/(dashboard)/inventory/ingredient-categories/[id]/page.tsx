import { IngredientCategoryDetail } from "./ingredient-category-detail"

export default async function IngredientCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <IngredientCategoryDetail categoryId={Number(id)} />
}
