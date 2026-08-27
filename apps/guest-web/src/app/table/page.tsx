import { Suspense } from "react";
import Skeleton from "@/components/skeleton";
import TableContent from "./table-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TablePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-6">
          <div className="mx-auto max-w-md space-y-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      }
    >
      <TableContent />
    </Suspense>
  );
}
