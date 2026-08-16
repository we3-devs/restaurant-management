import { Suspense } from "react";
import QRRedirectContent from "./qr-redirect-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function QRRedirect() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <QRRedirectContent />
    </Suspense>
  );
}
