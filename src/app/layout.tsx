import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivSentinel — Monitor. Protect. Stay Secure.",
  applicationName: "PrivSentinel",
  description:
    "PrivSentinel is a Windows-first endpoint security application. Explore product capabilities and access published releases.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/privsentinel-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/privsentinel-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/privsentinel-apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#080F1C",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
