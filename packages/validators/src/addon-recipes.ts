import { z } from "zod"

export const createAddonRecipeSchema = z.object({
  ingredientId: z.number({ message: "Select an ingredient" }).positive(),
  unitId: z.number({ message: "Select a unit" }).positive(),
  quantity: z.number().positive("Quantity must be positive"),
  wastageQuantity: z.number().min(0),
})

export type CreateAddonRecipeInput = z.infer<typeof createAddonRecipeSchema>
