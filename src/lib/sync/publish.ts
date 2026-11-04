/**
 * Publication de l'instantané dans Vercel Blob, où le site le lit.
 *
 * On publie si les données ont changé, ou si la dernière publication date de
 * plus de deux heures : c'est le signal de vie de la synchro (`checkedAt`), qui
 * permet au site de détecter une synchro arrêtée. Le plan Hobby limite les
 * écritures dans Blob à 2 000 par mois : publier à chaque passe (toutes les
 * 15 min) les dépasserait.
 */
import { put } from "@vercel/blob";
import type { Snapshot } from "../types";

export const HEARTBEAT_MS = 2 * 60 * 60 * 1000;

/** Champs qui changent à chaque lecture sans que les données changent. */
const VOLATILE = new Set(["fetchedAt", "updatedAt", "checkedAt", "failures", "historyFetchedAt"]);

export const stable = (s: Snapshot) => JSON.stringify(s, (k, v) => (VOLATILE.has(k) ? undefined : v));

/** Adresse d'un autre fichier du même store (config.json à côté de snapshot.json). */
export function siblingUrl(name: string): string | undefined {
  const url = process.env.SNAPSHOT_URL;
  return url ? url.replace(/[^/]+$/, name) : undefined;
}

export async function readPublished(): Promise<Snapshot | null> {
  const url = process.env.SNAPSHOT_URL;
  if (!url) return null;
  // Le paramètre contourne le CDN de Blob, qui garde le fichier 60 s.
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture de la version publiée : HTTP ${res.status}`);
  return (await res.json()) as Snapshot;
}

export type PublishOutcome = "published" | "heartbeat" | "unchanged" | "no-token";

export async function publishIfNeeded(snap: Snapshot, force = false): Promise<PublishOutcome> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return "no-token";
  const published = await readPublished();
  const changed = !published || stable(published) !== stable(snap);
  const lastBeat = published?.checkedAt ?? published?.updatedAt;
  const beatDue = !lastBeat || Date.now() - Date.parse(lastBeat) > HEARTBEAT_MS;
  if (!force && !changed && !beatDue) return "unchanged";
  await put("snapshot.json", JSON.stringify(snap), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return changed || force ? "published" : "heartbeat";
}
