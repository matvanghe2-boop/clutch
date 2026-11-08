/**
 * Ce que l'horaire d'un match peut cacher : une heure déplacée par Liquipedia depuis
 * qu'on l'a affichée, ou un autre de mes matchs joué en même temps.
 */
import { norm, type Oriented, type PastMatch, recentFeed, upcomingFeed } from "./derive";
import type { ScheduleMove, Snapshot } from "./types";

export type { ScheduleMove };

/** Un écart plus petit n'est qu'un arrondi de Liquipedia. */
const MOVE_MIN_S = 5 * 60;
/** On oublie un déplacement une demi-journée après le match. */
const MOVE_KEEP_S = 12 * 3600;

/** L'affiche, sans l'heure : l'équipe suivie et son adversaire. */
export function pairKey(o: Pick<Oriented, "team" | "them">): string | undefined {
  return o.them ? `${o.team.id}:${norm(o.them.page ?? o.them.name)}` : undefined;
}

const pastKey = (r: PastMatch) => (r.opponent ? `${r.team.id}:${norm(r.opponent.page ?? r.opponent.name)}` : undefined);

/** L'heure de chaque affiche à venir. Une affiche prévue deux fois (deux tours, deux phases) est écartée : ambiguë. */
export function scheduleOf(snap: Snapshot): Map<string, { ts: number; tbd: boolean }> {
  const map = new Map<string, { ts: number; tbd: boolean }>();
  const twice = new Set<string>();
  for (const o of upcomingFeed(snap)) {
    const key = pairKey(o);
    if (!key || o.match.timestamp === undefined) continue;
    if (map.has(key)) twice.add(key);
    else map.set(key, { ts: o.match.timestamp, tbd: Boolean(o.match.timeTbd) });
  }
  for (const key of twice) map.delete(key);
  return map;
}

/**
 * Compare l'horaire d'avant une lecture de Liquipedia à celui d'après, et note les heures
 * déplacées dans l'instantané. Une heure qui arrive (match d'abord sans horaire) n'est pas
 * un déplacement ; un match joué puis remplacé par une revanche non plus. Un match déplacé
 * deux fois garde sa première heure ; revenu à celle-ci, il n'est plus signalé.
 */
export function recordMoves(snap: Snapshot, before: Map<string, { ts: number; tbd: boolean }>, now = Date.now()): void {
  const after = scheduleOf(snap);
  const played = recentFeed(snap);
  const moves = { ...snap.moves };
  for (const [key, was] of before) {
    const is = after.get(key);
    if (!is || is.tbd || was.tbd || Math.abs(is.ts - was.ts) < MOVE_MIN_S) continue;
    // L'ancien match a eu lieu : la nouvelle heure est celle d'un autre match (revanche, finale).
    if (played.some((r) => pastKey(r) === key && Math.abs(r.timestamp - was.ts) < 3 * 3600)) continue;
    const from = moves[key]?.from ?? was.ts;
    if (Math.abs(from - is.ts) < MOVE_MIN_S) delete moves[key];
    else moves[key] = { from, to: is.ts, at: new Date(now).toISOString() };
  }
  for (const [key, m] of Object.entries(moves)) if (m.to < now / 1000 - MOVE_KEEP_S) delete moves[key];
  if (Object.keys(moves).length) snap.moves = moves;
  else delete snap.moves;
}

/** Le déplacement qui a mené ce match à son heure actuelle, s'il y en a un. */
export function moveOf(snap: Snapshot, o: Oriented): ScheduleMove | undefined {
  const key = pairKey(o);
  const move = key ? snap.moves?.[key] : undefined;
  if (!move || o.match.timeTbd || o.match.timestamp === undefined) return undefined;
  return Math.abs(move.to - o.match.timestamp) < 60 ? move : undefined;
}

/** Durée probable d'un match selon son format : de quoi savoir s'il en croise un autre. */
export function expectedLength(bestOf?: number): number {
  if (!bestOf) return 2.5 * 3600;
  if (bestOf <= 1) return 3600;
  if (bestOf <= 3) return 2.5 * 3600;
  if (bestOf <= 5) return 4 * 3600;
  return 5 * 3600;
}

/** Pour chaque match, ceux d'une autre de mes équipes qui se jouent en même temps. */
export function overlapsOf(feed: Oriented[]): Map<string, Oriented[]> {
  const timed = feed.filter((o) => o.match.timestamp !== undefined && !o.match.timeTbd);
  const out = new Map<string, Oriented[]>();
  for (const a of timed) {
    const start = a.match.timestamp!;
    const end = start + expectedLength(a.match.bestOf);
    const others = timed.filter((b) => {
      if (b === a || b.team.id === a.team.id) return false;
      const bStart = b.match.timestamp!;
      return bStart < end && start < bStart + expectedLength(b.match.bestOf);
    });
    if (others.length) out.set(a.match.id, others);
  }
  return out;
}

/** Ce qu'une ligne de match signale en plus de son heure. */
export interface MatchNote {
  moved?: ScheduleMove;
  /** Les noms courts des équipes qui jouent en même temps. */
  clash?: string[];
}

export function notesFor(snap: Snapshot, feed: Oriented[]): Map<string, MatchNote> {
  const clashes = overlapsOf(feed);
  const out = new Map<string, MatchNote>();
  for (const o of feed) {
    const moved = moveOf(snap, o);
    const clash = clashes.get(o.match.id)?.map((x) => x.us.short ?? x.team.page);
    if (moved || clash) out.set(o.match.id, { moved, clash });
  }
  return out;
}
