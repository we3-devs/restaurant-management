"use client"

import { VariantListManager } from "./variant-list-manager"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function VariantsPage() {
  usePageTitle("Variants")

  return (
    <VariantListManager list="variants" title="Variants" example="Chicken" />
  )
}
