import { LoadingFallback, ListSkeleton } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function PortalLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Skeleton className="h-7 w-56" />
        <ListSkeleton count={5} />
        <ListSkeleton count={3} />
      </div>
    </LoadingFallback>
  )
}
