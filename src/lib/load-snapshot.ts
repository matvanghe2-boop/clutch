import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { emptySnapshot, readSnapshot } from "./snapshot";
import { hasOnlineStore, readDoc } from "./store";
import type { Snapshot } from "./types";

/**
 * Combien de temps une instance du serveur garde l'instantané lu. La synchro le
 * réécrit au plus toutes les 5 minutes : 20 s de retard ne se voient pas, et chaque
 * page s'épargne la lecture de la base, le décompactage et la lecture du JSON.
 */
const MEMO_MS = 20_000;
let memo: { at: number; value: Promise<Snapshot> } | null = null;

async function fetchSnapshot(): Promise<Snapshot> {
  try {
    return { ...emptySnapshot(), ...(await readDoc<Snapshot>("snapshot")) };
  } catch (e) {
    // Au build, Next interrompt le rendu statique d'une page qui lit des données
    // fraîches en levant une erreur interne : elle doit remonter, ce n'est pas une panne.
    unstable_rethrow(e);
    console.error("Instantané illisible :", e);
    return emptySnapshot();
  }
}

/**
 * L'instantané que le site affiche. En production, la synchro le publie en ligne
 * (voir `store`) : les données changent sans commit ni redéploiement. En local, on
 * lit le fichier qu'écrit `npm run dev`.
 *
 * `cache` : une seule lecture par requête, quel que soit le nombre de
 * composants qui en ont besoin. En ligne, une copie partagée par les requêtes de
 * l'instance pendant `MEMO_MS` ; une lecture ratée (instantané vide) n'est pas gardée.
 */
export const loadSnapshot = cache(async (): Promise<Snapshot> => {
  if (!hasOnlineStore()) return readSnapshot();
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.value;
  const value = fetchSnapshot();
  memo = { at: now, value };
  value.then((s) => {
    if (!s.updatedAt && memo?.value === value) memo = null;
  });
  return value;
});
