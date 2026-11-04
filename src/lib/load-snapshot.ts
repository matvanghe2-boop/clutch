import { cache } from "react";
import { emptySnapshot, readSnapshot } from "./snapshot";
import type { Snapshot } from "./types";

/**
 * L'instantané que le site affiche. En production, la synchro le publie dans
 * Vercel Blob et `SNAPSHOT_URL` pointe dessus : les données changent sans
 * commit ni redéploiement. En local, sans cette variable, on lit le fichier
 * qu'écrit `npm run dev`.
 *
 * `cache` : une seule lecture par requête, quel que soit le nombre de
 * composants qui en ont besoin.
 */
export const loadSnapshot = cache(async (): Promise<Snapshot> => {
  const url = process.env.SNAPSHOT_URL;
  if (!url) return readSnapshot();
  try {
    // Pas de cache côté Next : le CDN de Blob garde déjà le fichier 60 s.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ...emptySnapshot(), ...((await res.json()) as Snapshot) };
  } catch (e) {
    console.error("Instantané illisible :", e);
    return emptySnapshot();
  }
});
