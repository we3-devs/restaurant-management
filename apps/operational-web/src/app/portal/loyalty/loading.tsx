import { ListSkeleton, LoadingFallback, StatGridSkeleton } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function PortalLoyaltyLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Skeleton className="h-7 w-48" />
        <StatGridSkeleton count={2} className="sm:grid-cols-2 xl:grid-cols-2" />
        <ListSkeleton count={5} />
      </div>
    </LoadingFallback>
  )
}
