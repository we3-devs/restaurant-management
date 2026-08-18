import { ListSkeleton, LoadingFallback } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function PortalLoyaltyLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Skeleton className="h-7 w-32" />

        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>

        <Skeleton className="h-5 w-20" />
        <ListSkeleton count={5} />
      </div>
    </LoadingFallback>
  )
}
