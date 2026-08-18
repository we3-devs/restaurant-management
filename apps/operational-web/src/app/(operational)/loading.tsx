import { LoadingFallback, TableSkeleton } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"

export default function OperationalLoading() {
  return (
    <LoadingFallback>
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <TableSkeleton rows={10} columns={5} />
      </div>
    </LoadingFallback>
  )
}
