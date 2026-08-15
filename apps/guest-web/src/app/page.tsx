"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function QRRedirect() {
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
        <p className="text-gray-600">Loading menu...</p>
      </div>
    </div>
  );
}
