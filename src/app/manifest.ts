import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Clutch",
    short_name: "Clutch",
    description: "Mes équipes esport : prochains matchs, résultats, poules et brackets.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    categories: ["sports", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Rocket League", url: "/?jeu=rl", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Counter-Strike 2", url: "/?jeu=cs2", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Call of Duty League", url: "/?jeu=cdl", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
