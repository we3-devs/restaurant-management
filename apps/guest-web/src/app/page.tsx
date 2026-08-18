import { Suspense } from "react";
import Skeleton from "@/components/skeleton";
import QRRedirectContent from "./qr-redirect-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function QRRedirect() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
          <div className="w-full max-w-md space-y-4 text-center">
            <Skeleton className="mx-auto size-12 rounded-full" />
            <Skeleton className="mx-auto h-6 w-44" />
            <Skeleton className="mx-auto h-4 w-64" />
          </div>
        </div>
      }
    >
      <QRRedirectContent />
    </Suspense>
  );
}
