import { LoadingFallback, TableSkeleton } from "@/components/ui/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <LoadingFallback>
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <TableSkeleton rows={10} columns={5} />
      </div>
    </LoadingFallback>
  )
}
