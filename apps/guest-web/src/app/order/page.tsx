import { Suspense } from "react";
import OrderContent from "./order-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <OrderContent />
    </Suspense>
  );
}
