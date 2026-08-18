import { LoadingFallback } from "@rms/ui/skeletons"
import { Skeleton } from "@rms/ui/skeleton"
import { Card, CardContent, CardHeader } from "@rms/ui/card"

export default function PortalLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Skeleton className="h-7 w-48" />

        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </LoadingFallback>
  )
}
