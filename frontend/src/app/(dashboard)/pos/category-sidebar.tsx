"use client"

import { cn } from "@/lib/utils"
import { useFoodCategories } from "@/hooks/use-food-categories"

export function CategorySidebar({
  categoryId,
  onSelect,
}: {
  categoryId: number | null
  onSelect: (categoryId: number | null) => void
}) {
  const { data: categories } = useFoodCategories({ limit: 100 })

  return (
    <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-input pr-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted",
          categoryId === null && "bg-muted font-medium",
        )}
      >
        All items
      </button>
      {categories?.data.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted",
            categoryId === category.id && "bg-muted font-medium",
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  )
}
