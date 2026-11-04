import { FOLLOWED, OTHER_TITLES } from "@/config/follow";
import { isTeam, orient, recentFeed, sameTeam, statusOf, upcomingFeed, type MatchStatus } from "./derive";
import { dayKey } from "./format";
import { tournamentMatches } from "./tournament";
import type { GameId, Match, Snapshot, Stream, TeamRef, Tournament, TournamentRef } from "./types";

/** « mes » : mes équipes seulement ; « tout » : aussi les autres matchs et compétitions du jeu. */
export type Scope = "mes" | "tout";

export interface CalMatch {
  id: string;
  game: GameId;
  timestamp: number;
  /** Jour à l'heure de Paris (AAAA-MM-JJ). */
  day: string;
  /** Une équipe suivie joue : elle est alors toujours en premier. */
  ours: boolean;
  teams: [TeamRef | null, TeamRef | null];
  scores: [string | null, string | null];
  result?: "win" | "loss" | "draw";
  status: MatchStatus;
  tournament?: TournamentRef;
  bestOf?: number;
  round?: string;
  streams: Stream[];
}

export interface CalCompetition {
  key: string;
  game: GameId;
  name: string;
  page: string;
  start: string;
  end: string;
  /** Une équipe suivie y est inscrite ou y joue. */
  participating: boolean;
  location?: string;
  prize?: string;
}

export interface CalendarData {
  matches: CalMatch[];
  competitions: CalCompetition[];
}

const isoDay = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

function fromMatch(m: Match, now: number): CalMatch | null {
  if (m.timestamp === undefined) return null;
  const team = FOLLOWED.find((f) => f.game === m.wiki && m.opponents.some((o) => isTeam(o, f)));
  const o = team ? orient(m, team) : null;
  return {
    id: m.id,
    game: m.wiki,
    timestamp: m.timestamp,
    day: dayKey(m.timestamp),
    ours: Boolean(o),
    teams: o ? [o.us, o.them] : m.opponents,
    scores: o ? [o.usScore, o.themScore] : m.scores,
    result: o?.result,
    status: statusOf(m, now),
    tournament: m.tournament,
    bestOf: m.bestOf,
    round: m.round,
    streams: m.streams,
  };
}

/** Période d'une compétition : infobox, sinon liste du jeu, sinon premier et dernier match. */
function span(t: Tournament, snap: Snapshot): { start: string; end: string } | null {
  const portal = snap.portals?.[t.wiki]?.entries.find((e) => e.page === t.page);
  const stamps = tournamentMatches(t)
    .map((m) => m.timestamp)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b);
  const start = t.startDate ?? portal?.startDate ?? (stamps.length ? isoDay(stamps[0]) : undefined);
  const end = t.endDate ?? portal?.endDate ?? (stamps.length ? isoDay(stamps.at(-1)!) : start);
  return start && end ? { start, end: end < start ? start : end } : null;
}

/** Un même match vu par deux sources : mêmes équipes, à moins de 3 h d'écart. */
function twins(a: CalMatch, b: CalMatch): boolean {
  if (a.game !== b.game || Math.abs(a.timestamp - b.timestamp) > 3 * 3600) return false;
  return (
    (sameTeam(a.teams[0], b.teams[0]) && sameTeam(a.teams[1], b.teams[1])) ||
    (sameTeam(a.teams[0], b.teams[1]) && sameTeam(a.teams[1], b.teams[0]))
  );
}

export function calendarData(snap: Snapshot, now: number, scope: Scope, game?: GameId): CalendarData {
  const matches: CalMatch[] = [];
  const add = (c: CalMatch | null) => {
    if (!c || (game && c.game !== game)) return;
    if (matches.some((x) => x.id === c.id || twins(x, c))) return;
    matches.push(c);
  };

  // Mes matchs à venir (page d'équipe, complétée par la compétition), puis mes résultats.
  for (const o of upcomingFeed(snap, game)) add(fromMatch(o.match, now));
  for (const r of recentFeed(snap, game)) {
    add({
      id: `${r.team.id}:${r.timestamp}`,
      game: r.team.game,
      timestamp: r.timestamp,
      day: dayKey(r.timestamp),
      ours: true,
      teams: [{ name: r.team.page, page: r.team.page, logo: snap.teams[r.team.id]?.logo }, r.opponent],
      scores: [r.usScore, r.themScore],
      result: r.result,
      status: "done",
      tournament: r.tournament,
      streams: [],
    });
  }

  // Tous les matchs des compétitions suivies : les miens que la page d'équipe
  // n'affiche pas encore (elle n'en montre que cinq), et en vue « tout » les autres.
  for (const t of Object.values(snap.tournaments)) {
    if (t.participating === false || (game && t.wiki !== game)) continue;
    for (const m of tournamentMatches(t)) {
      const c = fromMatch(m, now);
      if (c && (c.ours || scope === "tout")) add(c);
    }
  }

  const competitions: CalCompetition[] = [];
  for (const t of Object.values(snap.tournaments)) {
    if (game && t.wiki !== game) continue;
    if (OTHER_TITLES[t.wiki]?.test(t.info["Game"] ?? "")) continue;
    const participating = t.participating !== false;
    if (!participating && scope === "mes") continue;
    const s = span(t, snap);
    if (!s) continue;
    competitions.push({
      key: t.key,
      game: t.wiki,
      name: t.name,
      page: t.page,
      ...s,
      participating,
      location: t.info["Location"],
      prize: t.info["Prize Pool"],
    });
  }
  // En vue « tout », les compétitions de la liste du jeu pas encore lues.
  if (scope === "tout")
    for (const [wiki, portal] of Object.entries(snap.portals ?? {}) as [GameId, NonNullable<Snapshot["portals"]>[GameId]][]) {
      if (!portal || (game && wiki !== game)) continue;
      for (const e of portal.entries) {
        if (e.status === "completed" || !e.startDate || competitions.some((c) => c.game === wiki && c.page === e.page)) continue;
        competitions.push({
          key: `${wiki}:${e.page}`,
          game: wiki,
          name: e.name,
          page: e.page,
          start: e.startDate,
          end: e.endDate ?? e.startDate,
          participating: false,
        });
      }
    }

  matches.sort((a, b) => a.timestamp - b.timestamp);
  competitions.sort((a, b) => a.start.localeCompare(b.start) || Number(b.participating) - Number(a.participating));
  return { matches, competitions };
}

/** AAAA-MM-JJ → AAAA-MM-JJ décalé de n jours, sans fuseau. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Les jours affichés pour un mois : du lundi précédant le 1er au dimanche suivant le dernier. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  const start = addDays(first, -weekday);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const lastWeekday = (new Date(`${last}T12:00:00Z`).getUTCDay() + 6) % 7;
  const end = addDays(last, 6 - lastWeekday);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
