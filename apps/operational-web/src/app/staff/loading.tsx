import { ListSkeleton, LoadingFallback } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function StaffLoading() {
  return (
    <LoadingFallback>
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <ListSkeleton count={6} />
      </div>
    </LoadingFallback>
  )
}
