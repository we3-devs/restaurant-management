import { LoadingFallback, ListSkeleton } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function PortalOrdersLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
        <Skeleton className="h-7 w-48" />
        <ListSkeleton count={5} />
      </div>
    </LoadingFallback>
  )
}
