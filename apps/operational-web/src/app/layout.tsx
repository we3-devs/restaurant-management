import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@rms/api-client/query-provider";
import { ThemeProvider } from "@rms/ui/theme-provider";
import { Toaster } from "@rms/ui/sonner";
import { RealtimeIndicator } from "@rms/ui/realtime-indicator";
import { RouteProgress } from "@rms/ui/route-progress";
import { fetchBranding } from "@rms/api-client/branding";
import { BrandColor } from "@rms/api-client/brand-color";
import { BACKEND_API_BASE } from "@rms/auth/server/backend-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
          <QueryProvider persist>
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
