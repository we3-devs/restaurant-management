/**
 * Per-resource staleTime overrides. Reference/config data changes on the
 * order of "someone edited settings," not per request — these keep it out
 * of the refetch-on-mount/refocus path far longer than the global 30s
 * default. Mutations still invalidate the relevant keys immediately, so an
 * edit is reflected right away regardless of staleTime.
 */
export const STALE_TIME = {
  outlets: 30 * 60_000,
  departments: 30 * 60_000,
  tables: 60_000,
  foodVariants: 15 * 60_000,
  addons: 15 * 60_000,
  ingredients: 15 * 60_000,
  units: Infinity,
  ingredientCategories: Infinity,
  customersList: 5 * 60_000,
  /** Fallback for other static reference data without a called-out value above. */
  reference: 5 * 60_000,
} as const
