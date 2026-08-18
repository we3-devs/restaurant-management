import { Suspense } from "react";
import { CardGridSkeleton } from "@/components/skeleton";
import OrderContent from "./order-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-6">
          <div className="mx-auto max-w-2xl">
            <CardGridSkeleton count={2} className="grid-cols-1" />
          </div>
        </div>
      }
    >
      <OrderContent />
    </Suspense>
  );
}
