import { DetailPageSkeleton, LoadingFallback } from "@rms/ui/skeletons"

export default function PortalOrderDetailLoading() {
  return (
    <LoadingFallback>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <DetailPageSkeleton fields={4} />
      </div>
    </LoadingFallback>
  )
}
