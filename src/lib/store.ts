/**
 * Où vivent les documents du site : l'instantané, les équipes suivies, les pronostics.
 *
 * Avec une base Redis (Upstash, reliée au projet depuis le Marketplace de Vercel),
 * ils y sont écrits et relus sans délai ni limite d'écritures gênante. Vercel Blob
 * n'est plus qu'une sauvegarde : une copie par jour, relue si la base ne répond pas.
 *
 * Sans base, on reste sur Blob : 2 000 écritures par mois au plus, et une écriture
 * qui met une minute ou deux à traverser son CDN.
 *
 * Tout passe par l'API REST de la base : pas de connexion à tenir ouverte, ce qui
 * convient aux fonctions de Vercel, et aucune dépendance de plus. Les documents sont
 * compressés : le quota de 10 Go par mois compte les octets échangés.
 */
import zlib from "node:zlib";
import { put } from "@vercel/blob";

export type DocName = "snapshot" | "config" | "predictions" | "push" | "push-sent";

/**
 * Les documents copiés chaque jour dans Blob, qui est public. Les abonnements aux notifications
 * (`push`) et leur journal n'y vont jamais : ils ne vivent que dans la base.
 */
const DOCS: DocName[] = ["snapshot", "config", "predictions"];
const FILES: Record<DocName, string> = { snapshot: "snapshot.json", config: "config.json", predictions: "predictions.json", push: "push.json", "push-sent": "push-sent.json" };
const key = (name: DocName) => `clutch:${name}`;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Durée de cache CDN des copies dans Blob. Une réécriture se propage en moins d'une
 * minute quelle que soit cette durée ; une durée longue fait des lectures des « HIT »,
 * que le plan Hobby ne compte pas (10 000 lectures hors cache par mois au plus).
 */
export const CDN_MAX_AGE = 3600;

function credentials(): { url: string; token: string } | undefined {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  // Certaines installations ne donnent que l'adresse Redis : son mot de passe est le jeton REST.
  const m = process.env.REDIS_URL?.match(/^rediss?:\/\/[^:]*:([^@]+)@([^:/]+)/);
  return m ? { url: `https://${m[2]}`, token: m[1] } : undefined;
}

/** Hors de Vercel, jamais la base de production sans le demander (`CLUTCH_USE_DB=1`) : `vercel env pull` en donne l'accès. */
export const hasDatabase = () => Boolean((process.env.VERCEL || process.env.CLUTCH_USE_DB) && credentials());

const blobUrl = (name: DocName) => process.env.SNAPSHOT_URL?.replace(/[^/]+$/, FILES[name]);

/** Un stockage en ligne est configuré ; sinon, en local, les documents sont des fichiers de data/. */
export const hasOnlineStore = () => hasDatabase() || Boolean(process.env.SNAPSHOT_URL);

/** Peut-on y écrire ? */
export const canWrite = () => hasDatabase() || Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.SNAPSHOT_URL);

async function redis<T>(...command: (string | number)[]): Promise<T> {
  const { url, token } = credentials()!;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || body.error) throw new Error(`Base de données : ${body.error ?? `HTTP ${res.status}`}`);
  return body.result as T;
}

export const encode = (value: unknown) => zlib.gzipSync(JSON.stringify(value)).toString("base64");
export const decode = <T>(raw: string): T => JSON.parse(zlib.gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as T;

async function readBlob<T>(name: DocName): Promise<T | null> {
  const url = blobUrl(name);
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture de ${FILES[name]} : HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Les signaux internes de Next (rendu dynamique…) ne sont pas des pannes : ils doivent remonter. */
const isNextSignal = (e: unknown) => typeof e === "object" && e !== null && "digest" in e;

/**
 * Lit un document. À sa toute première lecture, la base reprend la version de Blob :
 * il n'y a rien à migrer à la main, et rien ne se perd.
 *
 * `strict` : une panne de la base est une erreur, au lieu d'un repli sur la copie
 * d'hier. À employer avant d'écrire : réécrire une copie ancienne perdrait ce qui a
 * changé depuis.
 */
export async function readDoc<T>(name: DocName, { strict = false } = {}): Promise<T | null> {
  if (!hasDatabase()) return readBlob<T>(name);
  try {
    const raw = await redis<string | null>("GET", key(name));
    if (raw) return decode<T>(raw);
    const old = await readBlob<T>(name);
    if (old !== null) await redis("SET", key(name), encode(old), "NX");
    return old;
  } catch (e) {
    if (strict || isNextSignal(e)) throw e;
    console.error(`[clutch] ${FILES[name]} : repli sur la sauvegarde, la base ne répond pas.`, e);
    return readBlob<T>(name);
  }
}

async function putBlob(name: DocName, value: unknown) {
  await put(FILES[name], JSON.stringify(value), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: CDN_MAX_AGE,
  });
}

/** Écrit un document. Faux s'il n'y a nulle part où l'écrire : en local, c'est à l'appelant d'en faire un fichier. */
export async function writeDoc(name: DocName, value: unknown): Promise<boolean> {
  if (hasDatabase()) {
    await redis("SET", key(name), encode(value));
    return true;
  }
  if (!canWrite()) return false;
  await putBlob(name, value);
  return true;
}

/**
 * Verrou de la base : il tombe tout seul au bout de `gapMs`. Une seule instance
 * l'obtient, même si plusieurs le demandent en même temps.
 */
export async function lockInDatabase(gapMs: number, reason: string): Promise<boolean> {
  return (await redis<string | null>("SET", "clutch:lock", JSON.stringify({ at: new Date().toISOString(), reason }), "NX", "PX", gapMs)) === "OK";
}

/** Une copie par jour dans Blob : une sauvegarde hors de la base, pour moins de 100 écritures par mois sur 2 000. */
export async function backupIfDue(): Promise<boolean> {
  if (!hasDatabase() || !process.env.BLOB_READ_WRITE_TOKEN) return false;
  if ((await redis<string | null>("SET", "clutch:backup-at", new Date().toISOString(), "NX", "PX", DAY_MS)) !== "OK") return false;
  for (const name of DOCS) {
    const raw = await redis<string | null>("GET", key(name));
    if (raw) await putBlob(name, decode(raw));
  }
  return true;
}
