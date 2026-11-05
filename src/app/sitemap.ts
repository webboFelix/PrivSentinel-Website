import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/env";

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
  const configuredUrl = getPublicAppUrl();
  if (!configuredUrl) return [];

  const baseUrl = configuredUrl.replace(/\/+$/, "");
  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
  }));
}
