import { IngredientDetail } from "./ingredient-detail"

export default async function IngredientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <IngredientDetail ingredientId={Number(id)} />
}
