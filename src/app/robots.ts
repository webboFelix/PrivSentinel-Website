import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  const sitemap = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/sitemap.xml` : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/admin", "/dashboard"],
    },
    ...(sitemap ? { sitemap } : {}),
  };
}
