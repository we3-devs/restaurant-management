import { ListSkeleton, LoadingFallback } from "@/components/skeleton";

export default function OrderLoading() {
  return (
    <LoadingFallback>
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-3">
          <ListSkeleton count={3} />
        </div>
      </div>
    </LoadingFallback>
  );
}
