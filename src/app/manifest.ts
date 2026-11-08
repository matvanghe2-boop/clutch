import type { MetadataRoute } from "next";
import { GAMES } from "@/config/follow";
import { teamsOf } from "@/lib/derive";
import { loadSnapshot } from "@/lib/load-snapshot";

/** Relu toutes les heures : une équipe ajoutée dans Réglages gagne son raccourci sans nouveau déploiement. */
export const revalidate = 3600;

/**
 * Le manifeste de l'appli installée. Ses raccourcis (appui long sur l'icône) mènent à Ce soir, à
 * chaque équipe suivie et au calendrier : ils suivent les équipes choisies dans Réglages.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const teams = teamsOf(await loadSnapshot().catch(() => ({}) as Awaited<ReturnType<typeof loadSnapshot>>));
  const icon = (name: string) => [{ src: `/icons/raccourci-${name}.png`, sizes: "96x96", type: "image/png" }];
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
      { name: "Ce soir", short_name: "Ce soir", url: "/ce-soir", icons: icon("ce-soir") },
      ...teams.map((t) => ({ name: `${t.page} · ${GAMES[t.game].short}`, short_name: `${t.page.replace(/^Team /, "")} ${GAMES[t.game].short}`, url: `/equipe/${t.id}`, icons: icon(t.game) })),
      { name: "Calendrier", short_name: "Calendrier", url: "/calendrier", icons: icon("calendrier") },
    ],
  };
}
