/**
 * Ce qui se joue ce soir pour mes équipes.
 *
 * Une soirée va de 6 h à 6 h le lendemain, à l'heure de Paris : un match de CDL à
 * 1 h du matin fait partie de la soirée de la veille, même vu à 2 h.
 */
import { type Oriented, type PastMatch, recentFeed, statusOf, upcomingFeed } from "./derive";
import { dayKey } from "./format";
import type { Snapshot } from "./types";

const EVENING_START_S = 6 * 3600;

/** La soirée à laquelle appartient un instant : AAAA-MM-JJ, le jour où elle a commencé. */
export const eveningKey = (ts: number) => dayKey(ts - EVENING_START_S);

/** Le lecteur apparaît une heure avant le début, et reste pendant le match. */
export const PLAYER_LEAD_S = 3600;

export interface Evening {
  key: string;
  /** Vrai si c'est bien ce soir ; sinon, la prochaine soirée où mes équipes jouent. */
  tonight: boolean;
  /** Les matchs à venir ou en cours de la soirée, dans l'ordre. */
  matches: Oriented[];
  /** Ceux déjà joués ce soir, du plus récent au plus ancien. */
  done: PastMatch[];
  /** Ceux qui n'ont pas encore d'horaire, quel que soit leur jour. */
  undated: Oriented[];
}

export function eveningOf(snap: Snapshot, now: number): Evening {
  const tonight = eveningKey(now);
  const feed = upcomingFeed(snap).filter((o) => statusOf(o.match, now) !== "stale");
  const undated = feed.filter((o) => o.match.timestamp === undefined);
  const dated = feed.filter((o) => o.match.timestamp !== undefined);
  const done = recentFeed(snap).filter((r) => eveningKey(r.timestamp) === tonight);
  const key = dated.some((o) => eveningKey(o.match.timestamp!) === tonight) || done.length ? tonight : dated[0] ? eveningKey(dated[0].match.timestamp!) : tonight;
  return { key, tonight: key === tonight, matches: dated.filter((o) => eveningKey(o.match.timestamp!) === key), done, undated };
}

/** Les matchs à regarder maintenant : en cours, ou dans l'heure si l'horaire est sûr. */
export function onAir(matches: Oriented[], now: number): Oriented[] {
  return matches.filter(({ match: m }) => {
    const st = statusOf(m, now);
    return st === "live" || (st === "upcoming" && m.timestamp !== undefined && !m.timeTbd && m.timestamp - now < PLAYER_LEAD_S);
  });
}
