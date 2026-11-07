/**
 * Publication de l'instantané, là où le site le lit (voir `../store`).
 *
 * Avec la base : à chaque passe qui a lu une page. Les heures de lecture sont ainsi
 * gardées, et chaque page revient à son heure.
 *
 * Sans base, sur Blob : seulement si les données ont changé, car le plan Hobby limite
 * les écritures à 2 000 par mois.
 *
 * Dans les deux cas, au moins toutes les deux heures : c'est le signal de vie de la
 * synchro (`checkedAt`), qui permet au site de détecter une synchro arrêtée.
 */
import { canWrite, hasDatabase, readDoc, writeDoc } from "../store";
import type { Snapshot } from "../types";

export const HEARTBEAT_MS = 2 * 60 * 60 * 1000;

/** Champs qui changent à chaque lecture sans que les données changent. */
const VOLATILE = new Set(["fetchedAt", "updatedAt", "checkedAt", "failures", "historyFetchedAt"]);
const CLOCK = new Set(["updatedAt", "checkedAt"]);

export const stable = (s: Snapshot) => JSON.stringify(s, (k, v) => (VOLATILE.has(k) ? undefined : v));

/** L'empreinte d'un instantané avant une passe : l'instantané, lui, est modifié sur place. */
export interface SnapshotState {
  stable: string;
  /** Tout sauf l'horloge de la passe : une passe sans aucune lecture ne change rien. */
  exact: string;
  beat?: string;
}

export function stateOf(s: Snapshot): SnapshotState {
  return {
    stable: stable(s),
    exact: JSON.stringify(s, (k, v) => (CLOCK.has(k) ? undefined : v)),
    beat: s.checkedAt ?? s.updatedAt ?? undefined,
  };
}

/** Le dernier instantané publié. Une panne de la base est une erreur : repartir de la sauvegarde d'hier écraserait le reste. */
export async function readPublished(): Promise<Snapshot | null> {
  return readDoc<Snapshot>("snapshot", { strict: true });
}

export type PublishOutcome = "published" | "saved" | "heartbeat" | "unchanged" | "no-token";

export async function publishIfNeeded(snap: Snapshot, before: SnapshotState | undefined, force = false): Promise<PublishOutcome> {
  if (!canWrite()) return "no-token";
  const changed = !before || stable(snap) !== before.stable;
  const touched = hasDatabase() && before !== undefined && stateOf(snap).exact !== before.exact;
  const beatDue = !before?.beat || Date.now() - Date.parse(before.beat) > HEARTBEAT_MS;
  if (!force && !changed && !touched && !beatDue) return "unchanged";
  await writeDoc("snapshot", snap);
  return changed || force ? "published" : touched ? "saved" : "heartbeat";
}
