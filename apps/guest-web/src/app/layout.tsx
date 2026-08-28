import type { Metadata } from "next";
import { fetchBranding } from "@rms/api-client/branding";
import { Toaster } from "react-hot-toast";
import { BrandColor } from "@/components/brand-color";
import { RouteProgress } from "@/components/route-progress";
import { Providers } from "@/providers";
import "./globals.css";

// Dynamic so a diner's browser tab shows the restaurant's own name and icon
// rather than a generic one. NEXT_PUBLIC_API_URL already includes /api.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
  );
  const name = branding.restaurantName ?? "Order Menu";

  return {
    title: name,
    description: `Order from ${name}`,
    icons: {
      icon: branding.faviconUrl ?? "/favicon.ico",
      apple: branding.faviconUrl ?? "/favicon.ico",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <RouteProgress />
          <BrandColor />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
