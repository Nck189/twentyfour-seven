import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "24/7",
    short_name: "24/7",
    description: "1 day = 24 hours = 7 blocks. A day planner that grows a cozy farm.",
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f4ec",
    theme_color: "#f7f4ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
