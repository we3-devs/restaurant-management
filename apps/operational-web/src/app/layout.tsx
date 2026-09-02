import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@rms/ui/theme-provider";
import { Toaster } from "@rms/ui/sonner";
// import { RealtimeIndicator } from "@rms/ui/realtime-indicator";
import { RouteProgress } from "@rms/ui/route-progress";
import { fetchBranding } from "@rms/api-client/branding";
import { StaticBrandColor } from "@rms/api-client/brand-color";
import { BACKEND_API_BASE } from "@rms/auth/server/backend-client";

// See dashboard-web's layout: dynamic so branding drives the tab, and the old
// src/app/favicon.ico had to move to public/ or it would outrank this.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(BACKEND_API_BASE);
  const name = branding.restaurantName ?? "RMS";

  return {
    title: `${name} Operations`,
    description: `${name} — Operations`,
    manifest: "/manifest.json",
    icons: {
      icon: branding.faviconUrl ?? "/icons/favicon.ico",
      apple: branding.faviconUrl ?? "/icons/favicon.ico",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0430de",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await fetchBranding(BACKEND_API_BASE);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RouteProgress />
          <StaticBrandColor primaryColor={branding.primaryColor} />
          {children}
          <Toaster />
          {/* <RealtimeIndicator /> */}
        </ThemeProvider>
      </body>
    </html>
  );
}
