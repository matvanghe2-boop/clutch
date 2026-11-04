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
const STATE_FILE = path.join(process.cwd(), "data", ".ratelimit.json");

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
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), "Accept-Encoding": "gzip" },
      });
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
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), "Accept-Encoding": "gzip" },
      });
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
