/**
 * Synchro sur Vercel. Deux modes, selon que la variable CRON_SECRET existe.
 *
 * Avec un cron externe (cron-job.org appelle /api/sync toutes les 5 min, avec
 * le secret) : c'est lui qui synchronise, par `scheduledPass`. Sans base de données,
 * il n'écrit rien dans Blob tant que les données ne changent pas : le plan Hobby
 * limite les écritures à 2 000 par mois, et l'accès à Blob est coupé 30 jours si on
 * les dépasse. Les visites ne servent plus que de secours, si la synchro se tait
 * plus de 2 h 30.
 *
 * Sans cron externe : les visites déclenchent la synchro (`autoRefresh`), après
 * l'envoi de la page, quand
 *   - la synchro n'a pas donné signe de vie depuis 2 h 30 : 4 pages au plus ;
 *   - un match d'une équipe suivie est en cours ou imminent : ses pages,
 *     toutes les 4 minutes au plus ;
 *   - les équipes ont changé dans les réglages.
 *
 * Les passes de secours prennent un verrou : deux passes simultanées doubleraient le
 * rythme des appels à Liquipedia.
 */
import { BlobNotFoundError, BlobPreconditionFailedError, head, put } from "@vercel/blob";
import { DEFAULT_TEAMS, type TeamConfig } from "../../config/follow";
import { liveSoon } from "../derive";
import { emptySnapshot } from "../snapshot";
import type { Snapshot } from "../types";
import { backupIfDue, canWrite, hasDatabase, lockInDatabase } from "../store";
import { runPass } from "./engine";
import { publishIfNeeded, readPublished, stateOf } from "./publish";
import { loadTeamConfig } from "./team-config";

const MIN = 60_000;
/** Au-delà, la synchro régulière est considérée comme arrêtée (elle publie au moins toutes les 2 h). */
export const STALE_MS = 150 * MIN;
const LOCK = "sync-lock.json";

/** Un cron externe synchronise : il est configuré avec ce secret. */
export const hasScheduler = () => Boolean(process.env.CRON_SECRET);

const signature = (list: TeamConfig[]) =>
  list
    .map((t) => `${t.game}:${t.page}:${t.watch ?? ""}`)
    .sort()
    .join("|");

const lastCheck = (s: Snapshot) => Date.parse(s.checkedAt ?? s.updatedAt ?? "") || 0;

/**
 * Une passe à la fois dans cette instance : une instance Vercel sert plusieurs
 * pages en même temps, et des passes concurrentes se partageraient le rythme
 * de Liquipedia jusqu'à dépasser toutes la durée maximale de la fonction.
 */
let running = false;

/** Une page ne commence plus après ce délai : il reste de quoi attendre Liquipedia (31 s + 30 s) et publier, sous les 300 s. */
const BUDGET_MS = 180_000;

function canRun(): boolean {
  if (!process.env.VERCEL || !canWrite()) return false;
  // Next exécute aussi les `after()` des pages qu'il génère au build : pas d'appel à Liquipedia depuis la machine de build.
  return process.env.NEXT_PHASE !== "phase-production-build";
}

/** Synchro de secours, après une visite (ou le cron quotidien de Vercel quand aucun cron externe n'est configuré). */
export async function autoRefresh(seen: Snapshot, { always = false } = {}): Promise<void> {
  if (!canRun() || running) return;
  running = true;
  try {
    const start = Date.now();
    const stale = always || start - lastCheck(seen) > STALE_MS;
    let live = false;
    let teamsChanged = false;
    if (!hasScheduler()) {
      live = liveSoon(seen, start / 1000);
      teamsChanged = signature(await loadTeamConfig()) !== signature(seen.followed ?? DEFAULT_TEAMS);
    }
    if (!stale && !live && !teamsChanged) return;

    const liveOnly = live && !stale && !teamsChanged;
    const reason = stale ? "synchro régulière en retard" : teamsChanged ? "équipes modifiées" : "match en cours";
    if (!(await takeLock(liveOnly ? 4 * MIN : 10 * MIN, reason))) return;

    const snap = (await readPublished()) ?? seen;
    const before = stateOf(snap);
    const result = await runPass(snap, {
      profile: "visit",
      teams: await loadTeamConfig(),
      maxPages: liveOnly ? 2 : 4,
      onlyLive: liveOnly,
      deadline: start + BUDGET_MS,
      log: (...args) => console.log("[clutch]", ...args),
    });
    const outcome = await publishIfNeeded(snap, before);
    console.log(`[clutch] passe de secours (${reason}) : ${result.pages} pages, ${outcome}`);
  } finally {
    running = false;
  }
}

/**
 * Passe du cron externe. Pas de verrou en temps normal : les appels sont
 * espacés de 5 minutes et une passe s'arrête avant 4. Seule exception : si la
 * synchro s'était tue, une passe de secours peut être en cours, on prend donc
 * le verrou pour ne pas la doubler.
 */
export async function scheduledPass(): Promise<void> {
  if (!canRun() || running) return;
  running = true;
  try {
    const start = Date.now();
    const snap = (await readPublished()) ?? emptySnapshot();
    if (start - lastCheck(snap) > STALE_MS && !(await takeLock(10 * MIN, "reprise de la synchro régulière"))) return;
    const before = stateOf(snap);
    const result = await runPass(snap, {
      profile: "cron",
      teams: await loadTeamConfig(),
      maxPages: 6,
      deadline: start + BUDGET_MS,
      log: (...args) => console.log("[clutch]", ...args),
    });
    const outcome = await publishIfNeeded(snap, before);
    console.log(`[clutch] synchro régulière : ${result.pages} pages, ${outcome}`);
    await backupIfDue().catch((e) => console.error("[clutch] sauvegarde dans Blob :", e));
  } finally {
    running = false;
  }
}

/**
 * Prend le verrou, sauf si une passe l'a pris il y a moins de `gap` ms. Sans base,
 * c'est sync-lock.json dans Blob, dont l'écriture est conditionnée à l'ETag lu : de
 * deux instances qui tentent leur chance en même temps, une seule l'emporte.
 */
async function takeLock(gap: number, reason: string): Promise<boolean> {
  if (hasDatabase()) return lockInDatabase(gap, reason);
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
