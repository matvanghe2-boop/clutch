import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { emptySnapshot, readSnapshot } from "./snapshot";
import { hasOnlineStore, readDoc } from "./store";
import type { Snapshot } from "./types";

/**
 * L'instantané que le site affiche. En production, la synchro le publie en ligne
 * (voir `store`) : les données changent sans commit ni redéploiement. En local, on
 * lit le fichier qu'écrit `npm run dev`.
 *
 * `cache` : une seule lecture par requête, quel que soit le nombre de
 * composants qui en ont besoin.
 */
export const loadSnapshot = cache(async (): Promise<Snapshot> => {
  if (!hasOnlineStore()) return readSnapshot();
  try {
    return { ...emptySnapshot(), ...(await readDoc<Snapshot>("snapshot")) };
  } catch (e) {
    // Au build, Next interrompt le rendu statique d'une page qui lit des données
    // fraîches en levant une erreur interne : elle doit remonter, ce n'est pas une panne.
    unstable_rethrow(e);
    console.error("Instantané illisible :", e);
    return emptySnapshot();
  }
});
