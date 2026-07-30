import { z } from "zod"

export const createFoodRecipeSchema = z.object({
  foodVariantId: z.number().positive().optional(),
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  unitId: z.number({ message: "Select a unit" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
  wastageQuantity: z.number().min(0),
})

export type CreateFoodRecipeInput = z.infer<typeof createFoodRecipeSchema>
