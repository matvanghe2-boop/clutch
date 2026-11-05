import fs from "node:fs";
import path from "node:path";
import type { GameId } from "../types";

/**
 * Seul point de contact avec Liquipedia. Les conditions d'utilisation de l'API
 * (liquipedia.net/api-terms-of-use) imposent :
 *   - un User-Agent qui nomme le projet et donne un contact ;
 *   - au plus 1 requête toutes les 2 s, et 1 `action=parse` toutes les 30 s ;
 *   - la prise en charge de gzip, et un cache aussi long que possible.
 * L'horodatage du dernier appel est gardé sur disque : relancer le processus
 * ne permet pas de dépasser le rythme.
 */

const GAP_ANY = 2_100;
const GAP_PARSE = 31_000;
/** Une réponse qui traîne au-delà est abandonnée : la passe continue avec la page suivante. */
const TIMEOUT = 30_000;
const request = (url: URL) =>
  fetch(url, { headers: { "User-Agent": userAgent(), "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(TIMEOUT) });
// Sur Vercel, seul /tmp est inscriptible ; une instance n'y garde son état que le temps de sa vie.
const STATE_FILE = process.env.VERCEL
  ? "/tmp/clutch-ratelimit.json"
  : path.join(process.cwd(), "data", ".ratelimit.json");

function userAgent(): string {
  const contact = process.env.LIQUIPEDIA_CONTACT || "https://github.com/matvanghe2-boop";
  return `Clutch/0.1 (tableau de bord esport personnel; ${contact})`;
}

export class LiquipediaError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface RateState {
  last: number;
  lastParse: number;
}

function readState(): RateState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as RateState;
  } catch {
    return { last: 0, lastParse: 0 };
  }
}

function writeState(state: RateState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une seule requête à la fois, et jamais plus vite que le rythme permis. */
let queue: Promise<unknown> = Promise.resolve();

function scheduled<T>(isParse: boolean, run: () => Promise<T>, onWait?: (ms: number) => void): Promise<T> {
  const next = queue.then(async () => {
    const state = readState();
    const at = Math.max(state.last + GAP_ANY, isParse ? state.lastParse + GAP_PARSE : 0);
    const wait = at - Date.now();
    if (wait > 0) {
      onWait?.(wait);
      await sleep(wait);
    }
    const now = Date.now();
    writeState({ last: now, lastParse: isParse ? now : state.lastParse });
    return run();
  });
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Le wikitexte brut d'une page, sans rendu : une requête légère, soumise au
 * seul écart général de 2 s. Sert aux listes tenues à la main, comme
 * Liquipedia:Tournaments.
 */
export function queryWikitext(wiki: GameId, title: string, onWait?: (ms: number) => void): Promise<string> {
  const url = new URL(`https://liquipedia.net/${wiki}/api.php`);
  url.search = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
  }).toString();

  return scheduled(
    false,
    async () => {
      const res = await request(url);
      if (!res.ok) throw new LiquipediaError(`http-${res.status}`, `HTTP ${res.status} sur ${wiki}:${title}`);
      const json = (await res.json()) as {
        query?: { pages?: { missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] };
      };
      const page = json.query?.pages?.[0];
      if (!page || page.missing) throw new LiquipediaError("missingtitle", `Page absente : ${wiki}:${title}`);
      return page.revisions?.[0]?.slots.main.content ?? "";
    },
    onWait,
  );
}

export async function apiQuery(wiki: GameId, params: Record<string, string>, onWait?: (ms: number) => void): Promise<unknown> {
  const url = new URL(`https://liquipedia.net/${wiki}/api.php`);
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params }).toString();
  return scheduled(
    false,
    async () => {
      const res = await request(url);
      if (!res.ok) throw new LiquipediaError(`http-${res.status}`, `HTTP ${res.status} sur ${wiki} (query)`);
      return res.json();
    },
    onWait,
  );
}

/** Titres des pages qui commencent par `prefix` (requête légère). */
export async function listPages(wiki: GameId, prefix: string, descending = false, onWait?: (ms: number) => void): Promise<string[]> {
  const json = (await apiQuery(
    wiki,
    { list: "allpages", apprefix: prefix, aplimit: "500", apnamespace: "0", ...(descending ? { apdir: "descending" } : {}) },
    onWait,
  )) as { query?: { allpages?: { title: string }[] } };
  return (json.query?.allpages ?? []).map((p) => p.title);
}

/**
 * Le début du wikitexte (section 0, où vit l'infobox) de plusieurs pages en une
 * requête légère : de quoi lire nom et dates de dizaines de compétitions sans
 * les rendre une à une (une page rendue toutes les 30 s).
 */
export async function leadSections(wiki: GameId, titles: string[], onWait?: (ms: number) => void): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = (await apiQuery(
      wiki,
      { titles: titles.slice(i, i + 50).join("|"), prop: "revisions", rvprop: "content", rvslots: "main", rvsection: "0" },
      onWait,
    )) as { query?: { pages?: { title: string; revisions?: { slots: { main: { content: string } } }[] }[] } };
    for (const p of json.query?.pages ?? []) out.set(p.title, p.revisions?.[0]?.slots.main.content ?? "");
  }
  return out;
}

/** La page existe-t-elle ? Renvoie son titre exact (redirections suivies), ou rien. */
export async function pageExists(wiki: GameId, title: string, onWait?: (ms: number) => void): Promise<string | undefined> {
  const json = (await apiQuery(wiki, { titles: title, redirects: "1" }, onWait)) as {
    query?: { pages?: { title: string; missing?: boolean }[] };
  };
  const page = json.query?.pages?.[0];
  return page && !page.missing ? page.title : undefined;
}

export interface ParsedPage {
  title: string;
  html: string;
}

export function parsePage(wiki: GameId, page: string, onWait?: (ms: number) => void): Promise<ParsedPage> {
  const url = new URL(`https://liquipedia.net/${wiki}/api.php`);
  url.search = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    format: "json",
    formatversion: "2",
    redirects: "1",
    disablelimitreport: "1",
    disableeditsection: "1",
    disabletoc: "1",
  }).toString();

  return scheduled(
    true,
    async () => {
      const res = await request(url);
      if (!res.ok) throw new LiquipediaError(`http-${res.status}`, `HTTP ${res.status} sur ${wiki}:${page}`);
      const json = (await res.json()) as {
        parse?: { title: string; text: string };
        error?: { code: string; info: string };
      };
      if (json.error) throw new LiquipediaError(json.error.code, json.error.info);
      if (!json.parse) throw new LiquipediaError("empty", `Réponse vide pour ${wiki}:${page}`);
      return { title: json.parse.title, html: json.parse.text };
    },
    onWait,
  );
}
