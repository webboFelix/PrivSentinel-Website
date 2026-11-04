import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/features",
  "/security",
  "/demo",
  "/download",
  "/help",
  "/faq",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return [];

  const baseUrl = configuredUrl.replace(/\/+$/, "");
  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
  }));
}
