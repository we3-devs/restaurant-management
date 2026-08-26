import { VariantListManager } from "../variants/variant-list-manager"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function SubVariantsPage() {
  usePageTitle("Sub Variants")

  return (
    <VariantListManager list="sub-variants" title="Sub-variants" example="Full" />
  )
}
