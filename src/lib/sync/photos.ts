/**
 * Les photos des joueurs : celle que Liquipedia met en tête de chaque page de joueur
 * (`pageprops.metaimage`), lue en une requête légère pour cinquante joueurs, puis sa vignette
 * et son crédit sur Liquipedia Commons, en une seconde requête. Une fois toutes les deux semaines.
 *
 * Ces photos ne sont pas libres : les organisateurs en autorisent l'usage à Liquipedia. Le site
 * ne les montre qu'au navigateur déverrouillé (choix de l'utilisateur, voir src/lib/photos.ts).
 */
import type { FollowedTeam } from "../../config/follow";
import { apiQuery, commonsQuery } from "../liquipedia/client";
import type { GameId, PlayerPhoto, RosterEntry, Snapshot } from "../types";

export const PHOTO_TTL_MS = 14 * 86_400_000;

export const photoKey = (wiki: GameId, page: string) => `${wiki}:${page}`;

/**
 * La page d'un joueur : celle du lien de l'effectif, sinon son pseudo (les effectifs lus avant
 * qu'on garde le lien) ; l'API suit majuscules et redirections.
 */
export const playerPage = (p: RosterEntry) => p.page ?? p.id;

/** Les pages de joueurs dont on veut la photo : mes effectifs et ceux des adversaires de la semaine. */
export function wantedPhotos(snap: Snapshot, teams: FollowedTeam[]): Map<GameId, string[]> {
  const out = new Map<GameId, Set<string>>();
  const add = (wiki: GameId, page?: string) => {
    if (!page) return;
    if (!out.has(wiki)) out.set(wiki, new Set());
    out.get(wiki)!.add(page);
  };
  for (const t of teams) for (const p of snap.teams[t.id]?.roster ?? []) add(t.game, playerPage(p));
  for (const o of Object.values(snap.opponents ?? {})) for (const p of o.roster) add(o.wiki, playerPage(p));
  return new Map([...out].map(([w, s]) => [w, [...s]]));
}

/** Celles qu'on n'a jamais cherchées, ou plus depuis deux semaines. */
export function stalePhotos(snap: Snapshot, teams: FollowedTeam[], now = Date.now()): Map<GameId, string[]> {
  const out = new Map<GameId, string[]>();
  for (const [wiki, pages] of wantedPhotos(snap, teams)) {
    const stale = pages.filter((p) => {
      const known = snap.photos?.[photoKey(wiki, p)];
      return !known || now - Date.parse(known.fetchedAt) > PHOTO_TTL_MS;
    });
    if (stale.length) out.set(wiki, stale);
  }
  return out;
}

/** Une ligne d'un modèle de wikitexte (« |author=… »), sans les liens. */
export function infoField(text: string, key: string): string | undefined {
  const line = text.split("\n").find((l) => l.startsWith(`|${key}=`));
  const value = line
    ?.slice(key.length + 2)
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\[\S+\]/g, "")
    .replace(/'{2,}/g, "")
    .trim();
  return value || undefined;
}

type PagesReply = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; pageprops?: { metaimage?: string } }[];
  };
};

type FilesReply = {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: { title: string; imageinfo?: { url?: string; thumburl?: string; descriptionurl?: string }[]; revisions?: { slots: { main: { content: string } } }[] }[];
  };
};

/** Les photos de ces joueurs (cinquante au plus par appel). Un joueur sans photo est noté quand même. */
export async function fetchPhotos(wiki: GameId, pages: string[], onWait?: (ms: number) => void): Promise<Record<string, PlayerPhoto>> {
  const at = new Date().toISOString();
  const out: Record<string, PlayerPhoto> = {};
  const chunk = pages.slice(0, 50);
  const reply = (await apiQuery(wiki, { titles: chunk.join("|"), prop: "pageprops", ppprop: "metaimage", redirects: "1" }, onWait)) as PagesReply;
  const alias = new Map<string, string>();
  for (const n of [...(reply.query?.normalized ?? []), ...(reply.query?.redirects ?? [])]) alias.set(n.from, n.to);
  const resolve = (title: string) => {
    let t = title;
    for (let i = 0; i < 4 && alias.has(t); i++) t = alias.get(t)!;
    return t;
  };
  const image = new Map((reply.query?.pages ?? []).map((p) => [p.title, p.pageprops?.metaimage]));
  const files = new Map<string, string>();
  for (const page of chunk) {
    out[photoKey(wiki, page)] = { fetchedAt: at };
    const file = image.get(resolve(page));
    if (file) files.set(page, file);
  }
  if (!files.size) return out;

  const titles = [...new Set(files.values())].map((f) => `File:${f}`);
  const info = (await commonsQuery({ titles: titles.join("|"), prop: "imageinfo|revisions", iiprop: "url", iiurlwidth: "480", rvprop: "content", rvslots: "main" }, onWait)) as FilesReply;
  const fileAlias = new Map((info.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const byTitle = new Map((info.query?.pages ?? []).map((p) => [p.title, p]));
  for (const [page, file] of files) {
    const p = byTitle.get(fileAlias.get(`File:${file}`) ?? `File:${file}`);
    const ii = p?.imageinfo?.[0];
    const src = ii?.thumburl ?? ii?.url;
    if (!src) continue;
    const text = p?.revisions?.[0]?.slots.main.content ?? "";
    out[photoKey(wiki, page)] = { src, file: ii?.descriptionurl, author: infoField(text, "author"), owner: infoField(text, "copyright"), fetchedAt: at };
  }
  return out;
}
