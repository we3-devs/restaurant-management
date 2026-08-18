import { CardGridSkeleton, LoadingFallback } from "@/components/skeleton";

export default function MenuLoading() {
  return (
    <LoadingFallback>
      <div className="min-h-screen bg-slate-50 px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <CardGridSkeleton count={4} columns={2} className="sm:grid-cols-2" />
        </div>
      </div>
    </LoadingFallback>
  );
}
