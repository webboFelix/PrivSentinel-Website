import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivSentinel — Monitor. Protect. Stay Secure.",
  description:
    "PrivSentinel is a Windows-first endpoint security application. Explore product capabilities and access published releases.",
  icons: {
    icon: "/PrivSentinel.png",
    apple: "/PrivSentinel.png",
  },
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
      </body>
    </html>
  );
}
