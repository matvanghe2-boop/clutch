/**
 * Synchro de secours, sur Vercel, déclenchée par l'ouverture du site (après
 * l'envoi de la page, sans la ralentir). Elle ne tourne que si :
 *   - la synchro planifiée n'a pas donné signe de vie depuis 2 h 30 (GitHub en
 *     retard, workflow désactivé…) : une passe de 4 pages au plus ;
 *   - un match d'une équipe suivie est en cours ou imminent : seulement ses
 *     pages, toutes les 4 minutes au plus (mode « match en cours ») ;
 *   - les équipes ont changé dans les réglages : on va chercher les nouvelles.
 * Un verrou (sync-lock.json dans Blob) empêche deux passes à la fois.
 */
import { BlobNotFoundError, BlobPreconditionFailedError, head, put } from "@vercel/blob";
import { DEFAULT_TEAMS, type TeamConfig } from "../../config/follow";
import { liveSoon } from "../derive";
import type { Snapshot } from "../types";
import { runPass } from "./engine";
import { publishIfNeeded, readPublished } from "./publish";
import { loadTeamConfig } from "./team-config";

const MIN = 60_000;
/** Au-delà, la synchro planifiée est considérée comme arrêtée (elle publie au moins toutes les 2 h). */
export const STALE_MS = 150 * MIN;
const LOCK = "sync-lock.json";

const signature = (list: TeamConfig[]) =>
  list
    .map((t) => `${t.game}:${t.page}:${t.watch ?? ""}`)
    .sort()
    .join("|");

/**
 * Une passe à la fois dans cette instance : une instance Vercel sert plusieurs
 * pages en même temps, et des passes concurrentes se partageraient le rythme
 * de Liquipedia jusqu'à dépasser toutes la durée maximale de la fonction.
 */
let running = false;

/** Une page ne commence plus après ce délai : il reste de quoi attendre Liquipedia (31 s + 30 s) et publier, sous les 300 s. */
const BUDGET_MS = 180_000;

/** `always` : le cron quotidien de Vercel (vercel.json), filet de sécurité même sans visite. */
export async function autoRefresh(seen: Snapshot, { always = false } = {}): Promise<void> {
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN || !process.env.SNAPSHOT_URL) return;
  if (running) return;
  running = true;
  try {
    const start = Date.now();
    const checked = Date.parse(seen.checkedAt ?? seen.updatedAt ?? "") || 0;
    const stale = always || start - checked > STALE_MS;
    const live = liveSoon(seen, start / 1000);
    // Version mise en cache par le CDN (60 s) : pas d'écriture ni de requête coûteuse à chaque visite.
    const teams = await loadTeamConfig();
    const teamsChanged = signature(teams) !== signature(seen.followed ?? DEFAULT_TEAMS);
    if (!stale && !live && !teamsChanged) return;

    const liveOnly = live && !stale && !teamsChanged;
    const reason = stale ? "synchro planifiée en retard" : teamsChanged ? "équipes modifiées" : "match en cours";
    if (!(await takeLock(liveOnly ? 4 * MIN : 10 * MIN, reason))) return;

    const snap = (await readPublished()) ?? seen;
    const result = await runPass(snap, {
      profile: "visit",
      teams: await loadTeamConfig(),
      maxPages: liveOnly ? 2 : 4,
      onlyLive: liveOnly,
      deadline: start + BUDGET_MS,
      log: (...args) => console.log("[clutch]", ...args),
    });
    const outcome = await publishIfNeeded(snap);
    console.log(`[clutch] passe de secours (${reason}) : ${result.pages} pages, ${outcome}`);
  } finally {
    running = false;
  }
}

/**
 * Prend le verrou (sync-lock.json), sauf si une passe l'a pris il y a moins de
 * `gap` ms. L'écriture est conditionnée à l'ETag lu : de deux instances qui
 * tentent leur chance en même temps, une seule l'emporte.
 */
async function takeLock(gap: number, reason: string): Promise<boolean> {
  let etag: string | undefined;
  try {
    const lock = await head(LOCK);
    if (Date.now() - lock.uploadedAt.getTime() < gap) return false;
    etag = lock.etag;
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) throw e;
  }
  try {
    await put(LOCK, JSON.stringify({ at: new Date().toISOString(), reason }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : {}),
    });
    return true;
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) return false;
    throw e;
  }
}
