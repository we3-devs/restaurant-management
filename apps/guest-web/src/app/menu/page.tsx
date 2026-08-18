import { Suspense } from "react";
import { CardGridSkeleton } from "@/components/skeleton";
import MenuContent from "./menu-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-5">
          <div className="mx-auto max-w-3xl">
            <CardGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />
          </div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
