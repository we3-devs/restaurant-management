"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Skeleton from "@/components/skeleton";

export default function QRRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  useEffect(() => {
    if (tableId) {
      router.replace(`/menu?table=${tableId}`);
    }
  }, [tableId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
        <Skeleton className="mx-auto h-4 w-44" />
      </div>
    </div>
  );
}
