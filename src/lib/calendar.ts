import type { FollowedTeam } from "@/config/follow";
import { isOtherTitle, isTeam, orient, recentFeed, sameTeam, statusOf, teamsOf, upcomingFeed, watchingTeam, type MatchStatus } from "./derive";
import { dayKey } from "./format";
import { tournamentMatches } from "./tournament";
import type { GameId, Match, PortalEntry, Snapshot, Stream, TeamRef, Tournament, TournamentRef } from "./types";
import { notesFor } from "./schedule";

/** « mes » : mes équipes seulement ; « tout » : aussi les autres matchs et compétitions du jeu. */
export type Scope = "mes" | "tout";

export interface CalMatch {
  id: string;
  game: GameId;
  timestamp: number;
  /** Le jour est connu, pas l'heure. */
  timeTbd?: boolean;
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
  /** L'heure qu'avait ce match avant que Liquipedia le déplace (voir schedule.ts). */
  movedFrom?: number;
  /** Mes autres équipes qui jouent en même temps. */
  clash?: string[];
}

/**
 * - « confirmed » : une équipe suivie y est inscrite ou y joue ;
 * - « watched » : une équipe suivie la dispute d'habitude (règle `watch` de
 *   la config), inscription pas encore confirmée ;
 * - « other » : le reste du circuit, pour la vue « Tout le circuit ».
 */
export type Relevance = "confirmed" | "watched" | "other";

export interface CalCompetition {
  key: string;
  game: GameId;
  name: string;
  page: string;
  start: string;
  end: string;
  relevance: Relevance;
  location?: string;
  prize?: string;
  /** Jouée en ligne (infobox « Type : Online »). */
  online?: boolean;
}

/** Un de mes matchs dont l'affiche est connue mais pas encore la date. */
export interface Unscheduled {
  id: string;
  game: GameId;
  teams: [TeamRef | null, TeamRef | null];
  tournament?: TournamentRef;
  round?: string;
  /** Période de la compétition : le match a lieu dedans. */
  span?: { start: string; end: string };
}

export interface CalendarData {
  matches: CalMatch[];
  competitions: CalCompetition[];
  unscheduled: Unscheduled[];
}

const isoDay = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

function fromMatch(m: Match, now: number, teams: FollowedTeam[]): CalMatch | null {
  if (m.timestamp === undefined) return null;
  const team = teams.find((f) => f.game === m.wiki && m.opponents.some((o) => isTeam(o, f)));
  const o = team ? orient(m, team) : null;
  return {
    id: m.id,
    game: m.wiki,
    timestamp: m.timestamp,
    timeTbd: m.timeTbd,
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

/** Les entrées de liste (liste du jeu, listes par niveau) qui parlent d'une page. */
function listEntries(snap: Snapshot): PortalEntry[] {
  return [
    ...Object.values(snap.portals ?? {}).flatMap((p) => p?.entries ?? []),
    ...Object.values(snap.listings ?? {}).flatMap((l) => l.entries),
  ];
}

/** Période d'une compétition : infobox, sinon listes, sinon premier et dernier match. */
function span(t: Tournament, entries: PortalEntry[]): { start: string; end: string } | null {
  const listed = entries.find((e) => e.wiki === t.wiki && e.page === t.page && e.startDate);
  const stamps = tournamentMatches(t)
    .map((m) => m.timestamp)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b);
  const start = t.startDate ?? listed?.startDate ?? (stamps.length ? isoDay(stamps[0]) : undefined);
  const end = t.endDate ?? listed?.endDate ?? (stamps.length ? isoDay(stamps.at(-1)!) : start);
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

/**
 * `hidden` : compétitions masquées depuis ce navigateur (clés « wiki:page ») ;
 * leurs bandes et leurs matchs disparaissent.
 */
export function calendarData(snap: Snapshot, now: number, scope: Scope, game?: GameId, hidden = new Set<string>()): CalendarData {
  const teams = teamsOf(snap);
  const matches: CalMatch[] = [];
  const isHidden = (wiki: GameId, page?: string) => Boolean(page && hidden.has(`${wiki}:${page}`));
  const add = (c: CalMatch | null) => {
    if (!c || (game && c.game !== game) || isHidden(c.game, c.tournament?.page)) return;
    if (matches.some((x) => x.id === c.id || twins(x, c))) return;
    matches.push(c);
  };

  // Mes matchs à venir (page d'équipe, complétée par la compétition), puis mes résultats.
  const notes = notesFor(snap, upcomingFeed(snap));
  for (const o of upcomingFeed(snap, game)) {
    const c = fromMatch(o.match, now, teams);
    const note = notes.get(o.match.id);
    if (c && note) Object.assign(c, { movedFrom: note.moved?.from, clash: note.clash });
    add(c);
  }
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
      const c = fromMatch(m, now, teams);
      if (c && (c.ours || scope === "tout")) add(c);
    }
  }

  const entries = listEntries(snap);
  const competitions: CalCompetition[] = [];
  const keep = (c: CalCompetition) => {
    if ((game && c.game !== game) || isHidden(c.game, c.page)) return;
    if (scope === "mes" && c.relevance === "other") return;
    if (competitions.some((x) => x.game === c.game && x.page === c.page)) return;
    competitions.push(c);
  };

  const today = dayKey(now);
  for (const t of Object.values(snap.tournaments)) {
    if (isOtherTitle(t.wiki, t.name, t.info["Game"])) continue;
    const s = span(t, entries);
    if (!s) continue;
    const tier = t.info["Liquipedia Tier"] ?? entries.find((e) => e.page === t.page && e.tier)?.tier;
    // Liste des participants close (l'événement a commencé, ou toutes les places
    // sont attribuées) sans mon équipe : on sait qu'elle n'y joue pas.
    const listed = t.participants?.length ?? 0;
    const places = Number(t.info["Number of teams"]?.match(/\d+/)?.[0] ?? 0);
    const closed = listed > 0 && (s.start <= today || (places > 0 && listed >= places));
    keep({
      key: t.key,
      game: t.wiki,
      name: t.name,
      page: t.page,
      ...s,
      relevance:
        t.participating !== false ? "confirmed" : !closed && watchingTeam(teams, t.wiki, t.page, tier) ? "watched" : "other",
      location: t.info["Location"],
      prize: t.info["Prize Pool"],
      online: /online/i.test(t.info["Type"] ?? ""),
    });
  }
  // Compétitions connues par les listes seulement : pas encore lues en détail,
  // souvent parce qu'elles sont loin. C'est la vue à plusieurs mois.
  for (const e of entries) {
    if (e.status === "completed" || !e.startDate || isOtherTitle(e.wiki, e.name)) continue;
    // Déjà lue en détail : elle a été retenue (ou écartée) plus haut, en connaissance de cause.
    if (snap.tournaments[`${e.wiki}:${e.page}`]) continue;
    keep({
      key: `${e.wiki}:${e.page}`,
      game: e.wiki,
      name: e.name,
      page: e.page,
      start: e.startDate,
      end: e.endDate ?? e.startDate,
      relevance: watchingTeam(teams, e.wiki, e.page, e.tier) ? "watched" : "other",
      location: e.location,
      prize: e.prize,
    });
  }

  // Mes matchs à l'affiche connue mais sans date : listés à part jusqu'à ce que Liquipedia les programme.
  const unscheduled: Unscheduled[] = [];
  for (const t of Object.values(snap.tournaments)) {
    if (t.participating === false || (game && t.wiki !== game)) continue;
    for (const m of tournamentMatches(t)) {
      const team = teams.find((f) => f.game === t.wiki && m.opponents.some((o) => isTeam(o, f)));
      if (!team || m.finished || m.timestamp !== undefined || !m.opponents.every(Boolean) || isHidden(t.wiki, t.page)) continue;
      const o = orient(m, team);
      unscheduled.push({
        id: m.id,
        game: t.wiki,
        teams: [o.us, o.them],
        tournament: m.tournament,
        round: m.round,
        span: span(t, entries) ?? undefined,
      });
    }
  }

  const rank: Record<Relevance, number> = { confirmed: 0, watched: 1, other: 2 };
  matches.sort((a, b) => a.timestamp - b.timestamp);
  competitions.sort((a, b) => a.start.localeCompare(b.start) || rank[a.relevance] - rank[b.relevance]);
  return { matches, competitions, unscheduled };
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
