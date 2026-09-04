import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
// import { RealtimeIndicator } from "@rms/ui/realtime-indicator";
import { RouteProgress } from "@rms/ui/route-progress";
import { fetchBranding } from "@rms/api-client/branding";
import { StaticBrandColor } from "@rms/api-client/brand-color";
import { BACKEND_API_BASE } from "@/lib/server/backend-client";

// generateMetadata rather than a static `metadata` object so the tab title and
// favicon follow Settings → Appearance. Note the old src/app/favicon.ico was
// moved to public/: file-convention metadata outranks anything returned here,
// so leaving it in place would have silently pinned the old icon.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(BACKEND_API_BASE);
  const name = branding.restaurantName ?? "Restra ";

  return {
    title: name,
    description: `${name} — Restaurant Management System`,
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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
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
