import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
// import { RealtimeIndicator } from "@rms/ui/realtime-indicator";
import { RouteProgress } from "@rms/ui/route-progress";
import { fetchBranding } from "@rms/api-client/branding";
import { StaticBrandColor } from "@rms/api-client/brand-color";
import { BACKEND_API_BASE } from "@/lib/server/backend-client";
import { brandingHeaders, currentTenantName } from "@/lib/tenant";
import { RegisterStaffServiceWorker } from "./operational/staff/register-sw";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(BACKEND_API_BASE, await brandingHeaders());
  const name = await currentTenantName();
  const staffName = `${name} Staff`;
  const appIcon = branding.logoUrl ?? branding.faviconUrl ?? "/icons/favicon.ico";

  return {
    title: staffName,
    description: `${name} — Restaurant Management System`,
    manifest: "/manifest.json",
    icons: {
      icon: appIcon,
      apple: appIcon,
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
  const branding = await fetchBranding(BACKEND_API_BASE, await brandingHeaders());

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <RouteProgress />
          <StaticBrandColor primaryColor={branding.primaryColor} />
          <RegisterStaffServiceWorker />
          {children}
          <Toaster />
          {/* <RealtimeIndicator /> */}
        </ThemeProvider>
      </body>
    </html>
  );
}
