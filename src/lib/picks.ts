/** Les matchs qui attendent encore un pronostic. */
import { type Oriented, statusOf, undatedId, upcomingFeed } from "./derive";
import type { Predictions } from "./predictions";
import type { Snapshot } from "./types";

/**
 * Mes matchs à venir dans `horizon` secondes, adversaire connu, sans pronostic. Un match sans
 * heure précise compte s'il est annoncé pour ce jour-là.
 */
export function awaitingPick(snap: Snapshot, predictions: Predictions, now: number, horizon: number): Oriented[] {
  return upcomingFeed(snap).filter(({ match: m, them }) => {
    if (!them || m.timestamp === undefined || statusOf(m, now) !== "upcoming") return false;
    if (m.timestamp - now > horizon) return false;
    return !predictions[m.id] && !predictions[undatedId(m)];
  });
}

/** Le pastille du menu : les pronostics à faire pour les prochaines 24 heures. */
export const PICK_SOON_S = 24 * 3600;
