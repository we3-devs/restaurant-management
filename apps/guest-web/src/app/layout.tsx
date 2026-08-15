import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Providers } from "@/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Menu",
  description: "Restaurant QR menu ordering",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
