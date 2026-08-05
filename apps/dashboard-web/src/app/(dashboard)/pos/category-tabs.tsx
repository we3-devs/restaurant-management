"use client"

import { cn } from "@/lib/utils"
import { useFoodCategories } from "@/hooks/use-food-categories"

export function CategoryTabs({
  categoryId,
  onSelect,
}: {
  categoryId: number | null
  onSelect: (categoryId: number | null) => void
}) {
  const { data: categories } = useFoodCategories({ limit: 100 })

  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-input pb-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
          categoryId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-muted-foreground hover:bg-muted",
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
            "shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
            categoryId === category.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  )
}
