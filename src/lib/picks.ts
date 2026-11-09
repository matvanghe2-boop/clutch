/** Les matchs qui attendent encore un pronostic. */
import { type Oriented, statusOf, undatedId, upcomingFeed } from "./derive";
import { findPick, type Predictions } from "./predictions";
import type { Snapshot } from "./types";

/**
 * Mes matchs à venir dans `horizon` secondes, adversaire connu, sans pronostic. Un match sans
 * heure précise compte s'il est annoncé pour ce jour-là.
 */
export function awaitingPick(snap: Snapshot, predictions: Predictions, now: number, horizon: number): Oriented[] {
  return upcomingFeed(snap).filter(({ match: m, them, team }) => {
    if (!them || m.timestamp === undefined || statusOf(m, now) !== "upcoming") return false;
    if (m.timestamp - now > horizon) return false;
    return !findPick(predictions, { wiki: m.wiki, teamId: team.id, opponent: { name: them.name, page: them.page }, timestamp: m.timestamp }, [m.id, undatedId(m)]);
  });
}

/** Le pastille du menu : les pronostics à faire pour les prochaines 24 heures. */
export const PICK_SOON_S = 24 * 3600;
