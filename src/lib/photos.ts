/**
 * Les photos de joueurs à l'affichage. Elles appartiennent aux organisateurs (BLAST, Esports World
 * Cup…), qui en autorisent l'usage à Liquipedia seulement : à la demande de l'utilisateur, le site
 * ne les montre qu'au navigateur déverrouillé avec le code des réglages, avec leur crédit. Les
 * autres visiteurs voient les cartes sans photo. Les images restent chez Liquipedia.
 */
import { photoKey, playerPage } from "./sync/photos";
import type { GameId, PlayerPhoto, RosterEntry, Snapshot } from "./types";

/** Les photos d'un effectif, par pseudo. Vide quand le navigateur n'est pas déverrouillé. */
export function rosterPhotos(snap: Snapshot, wiki: GameId, roster: RosterEntry[], allowed: boolean): Record<string, PlayerPhoto> {
  if (!allowed) return {};
  const out: Record<string, PlayerPhoto> = {};
  for (const p of roster) {
    const photo = snap.photos?.[photoKey(wiki, playerPage(p))];
    if (photo?.src) out[p.id] = photo;
  }
  return out;
}

/** « Photo Stephanie Lindgren · BLAST ». */
export const photoCredit = (p: PlayerPhoto) => [p.author ? `Photo ${p.author}` : "Photo Liquipedia", p.owner].filter(Boolean).join(" · ");
