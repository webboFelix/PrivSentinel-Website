import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PrivSentinel",
    short_name: "PrivSentinel",
    description: "PrivSentinel security dashboard and account portal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080F1C",
    theme_color: "#080F1C",
    icons: [
      {
        src: "/privsentinel-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/privsentinel-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/privsentinel-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
