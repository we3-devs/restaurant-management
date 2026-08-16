import { Suspense } from "react";
import MenuContent from "./menu-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <MenuContent />
    </Suspense>
  );
}
