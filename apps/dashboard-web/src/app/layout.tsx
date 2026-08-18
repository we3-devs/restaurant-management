import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeIndicator } from "@rms/ui/realtime-indicator";
import { RouteProgress } from "@rms/ui/route-progress";
import { fetchBranding } from "@rms/api-client/branding";
import { BrandColor } from "@rms/api-client/brand-color";
import { BACKEND_API_BASE } from "@/lib/server/backend-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// generateMetadata rather than a static `metadata` object so the tab title and
// favicon follow Settings → Appearance. Note the old src/app/favicon.ico was
// moved to public/: file-convention metadata outranks anything returned here,
// so leaving it in place would have silently pinned the old icon.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(BACKEND_API_BASE);
  const name = branding.restaurantName ?? "RMS";

  return {
    title: name,
    description: `${name} — Restaurant Management System`,
    manifest: "/manifest.json",
    icons: {
      icon: branding.faviconUrl ?? "/favicon.ico",
      apple: branding.faviconUrl ?? "/icons/icon.svg",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0430de",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <RouteProgress />
            <BrandColor />
            {children}
            <Toaster />
            <RealtimeIndicator />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
