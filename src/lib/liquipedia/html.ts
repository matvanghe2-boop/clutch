import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { GameId, GameResult, Match, Stream, TeamRef, TournamentRef } from "../types";

export type El = Cheerio<AnyNode>;

export const ORIGIN = "https://liquipedia.net";

export function abs(src?: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return ORIGIN + src;
  return src;
}

export function clean(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function text($el: El): string {
  return clean($el.text());
}

/** Titre de page Liquipedia → segment d'URL (« Gentle Mates » → « Gentle_Mates »). */
export function pageToPath(page: string): string {
  return page.replace(/ /g, "_");
}

/** « /rocketleague/NEO/Coupe_de_France_Slash/2026#Day_2 » → wiki, page, ancre. */
export function parseHref(href?: string): { wiki: string; page: string; anchor?: string } | null {
  if (!href) return null;
  const m = href.match(/^(?:https?:\/\/liquipedia\.net)?\/([a-z0-9]+)\/([^?#]+)(?:#(.*))?$/);
  if (!m || m[2].startsWith("index.php")) return null;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s).replace(/_/g, " ");
    } catch {
      return s.replace(/_/g, " ");
    }
  };
  return { wiki: m[1], page: decode(m[2]), anchor: m[3] ? decode(m[3]) : undefined };
}

/** « …/thumb/a/ab/X.png/1200px-X.png » → même image en 120 px au plus. */
function capThumb(url?: string): string | undefined {
  return url?.replace(/\/(\d+)px-([^/]+)$/, (all, px: string, file: string) => (Number(px) > 120 ? `/120px-${file}` : all));
}

function fromSrcset($img: El): string | undefined {
  if (!$img.length) return undefined;
  const srcset = $img.attr("srcset");
  if (srcset) {
    const parts = srcset.split(",").map((s) => s.trim().split(/\s+/));
    const best = parts.find((p) => p[1] === "2x") ?? parts.at(-1);
    if (best?.[0]) return capThumb(abs(best[0]));
  }
  return capThumb(abs($img.attr("src")));
}

/** Logo d'équipe : variante sombre d'abord, puis « allmode », puis la première image. */
export function logoFrom($scope: El): string | undefined {
  const dark = $scope.find(".team-template-darkmode img").first();
  if (dark.length) return fromSrcset(dark);
  return fromSrcset($scope.find("img").first());
}

const PLACEHOLDER = /^(tbd|tba|bye|)$/i;

/** Équipe depuis un bloc `.block-team` ou `.team-template-team-*`. */
export function teamFrom($: CheerioAPI, $block: El, fallbackName?: string): TeamRef | null {
  const link = $block
    .find("a[href]")
    .filter((_, a) => !/Special:|File:/.test($(a).attr("href") ?? ""))
    .first();
  const parsed = parseHref(link.attr("href"));
  const name =
    text($block.find(".team-name").first()) ||
    text($block.find(".team-template-text").first()) ||
    link.attr("title") ||
    fallbackName ||
    text($block.find(".name").first());
  if (!name || PLACEHOLDER.test(name)) return null;
  const short = text($block.find(".team-shortname").first()) || undefined;
  return { name: clean(name), short, page: parsed?.page, logo: logoFrom($block) };
}

export function streamsFrom($: CheerioAPI, $scope: El): Stream[] {
  const out: Stream[] = [];
  const seen = new Set<string>();
  $scope.find('a[href*="Special:Stream/"]').each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const m = href.match(/Special:Stream\/([^/]+)\/(.+)$/);
    if (!m) return;
    const platform = m[1].toLowerCase();
    const channel = decodeURIComponent(m[2]);
    const key = `${platform}/${channel}`;
    if (seen.has(key)) return;
    seen.add(key);
    const url =
      platform === "twitch"
        ? `https://www.twitch.tv/${channel}`
        : platform === "kick"
          ? `https://kick.com/${channel}`
          : (abs(href) ?? href);
    out.push({ platform, channel, url });
  });
  return out;
}

export function timerFrom($scope: El): { timestamp?: number; finished: boolean } {
  const t = $scope.find(".timer-object[data-timestamp]").first();
  if (!t.length) return { finished: false };
  const ts = Number(t.attr("data-timestamp"));
  return {
    timestamp: Number.isFinite(ts) && ts > 0 ? ts : undefined,
    finished: Boolean(t.attr("data-finished")),
  };
}

/** Ce que contient le popup de détail d'un match, commun aux listes et aux brackets. */
export function popupInfo($: CheerioAPI, $popup: El) {
  const { timestamp, finished } = timerFrom($popup);
  const pages = $popup
    .find(".match-info-header-opponent")
    .toArray()
    .slice(0, 2)
    .map((o) => {
      const a = $(o).find("a[href]").first();
      return { page: parseHref(a.attr("href"))?.page, logo: logoFrom($(o)) };
    });
  const games: GameResult[] = [];
  $popup.find(".brkts-popup-body-game").each((_, g) => {
    const cells = $(g).children(".brkts-popup-spaced");
    if (cells.length < 2) return;
    const left = cells.first();
    const right = cells.last();
    const map = cells.length >= 3 ? text($(cells.get(1)!)) || undefined : undefined;
    const score1 = text(left) || undefined;
    const score2 = text(right) || undefined;
    const winner = left.find('[data-label-type="result-win"]').length
      ? 1
      : right.find('[data-label-type="result-win"]').length
        ? 2
        : undefined;
    if (!map && !score1 && !score2) return;
    games.push({ map, score1, score2, winner });
  });
  const bo = clean($popup.text()).match(/\(?\bBo(\d+)\)?/i);
  return {
    timestamp,
    finished,
    pages,
    games,
    streams: streamsFrom($, $popup),
    bestOf: bo ? Number(bo[1]) : undefined,
  };
}

function slug(t: TeamRef | null): string {
  return (t?.page ?? t?.name ?? "tbd").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function matchId(wiki: GameId, timestamp: number | undefined, a: TeamRef | null, b: TeamRef | null): string {
  const pair = [slug(a), slug(b)].sort().join("~");
  return `${wiki}:${timestamp ?? "nodate"}:${pair}`;
}

export function scoreWinner(scores: [string | null, string | null]): 1 | 2 | undefined {
  const [a, b] = scores.map((s) => (s && /^\d+$/.test(s) ? Number(s) : NaN));
  if (Number.isNaN(a) || Number.isNaN(b) || a === b) return undefined;
  return a > b ? 1 : 2;
}

export function makeMatch(
  wiki: GameId,
  fields: Omit<Match, "id" | "wiki" | "streams" | "games"> & Partial<Pick<Match, "streams" | "games">>,
  tournament?: TournamentRef,
): Match {
  return {
    id: matchId(wiki, fields.timestamp, fields.opponents[0], fields.opponents[1]),
    wiki,
    streams: [],
    games: [],
    ...fields,
    tournament: fields.tournament ?? tournament,
  };
}
