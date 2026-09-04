import { IngredientWastageDetail } from "./ingredient-wastage-detail"

export default async function IngredientWastageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <IngredientWastageDetail wastageId={Number(id)} />
}
