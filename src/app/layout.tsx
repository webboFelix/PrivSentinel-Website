import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  const authAvailable = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SiteHeader authAvailable={authAvailable} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
