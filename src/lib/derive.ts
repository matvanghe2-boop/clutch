import { DEFAULT_TEAMS, type FollowedTeam, OTHER_TITLES, toFollowed } from "@/config/follow";
import { dayKey } from "./format";
import { tournamentMatches } from "./tournament";
import type { Prediction } from "./predictions";
import type { GameId, Match, RankingRow, RecentMatch, Snapshot, StandingRow, TeamRef, Tournament, TournamentRef } from "./types";

export function norm(s?: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les équipes suivies : celles de la dernière passe de synchro (réglées depuis
 * le site), sinon celles par défaut de la configuration.
 */
export function teamsOf(snap: Snapshot): FollowedTeam[] {
  return (snap.followed?.length ? snap.followed : DEFAULT_TEAMS).map(toFollowed);
}

export function isTeam(ref: TeamRef | null | undefined, team: FollowedTeam): boolean {
  if (!ref) return false;
  const names = [team.page, ...(team.aliases ?? [])].map(norm);
  return names.includes(norm(ref.page)) || names.includes(norm(ref.name));
}

export function sameTeam(a: TeamRef | null | undefined, b: TeamRef | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.page && b.page) return norm(a.page) === norm(b.page);
  return norm(a.name) === norm(b.name) || norm(a.page) === norm(b.name) || norm(a.name) === norm(b.page);
}

export const teamById = (snap: Snapshot, id: string) => teamsOf(snap).find((t) => t.id === id);

export type MatchStatus = "upcoming" | "live" | "done" | "stale";

/** Un match commencé depuis plus de 5 h sans résultat : la donnée est en retard, pas le match. */
export function statusOf(m: Match, now: number): MatchStatus {
  if (m.finished) return "done";
  if (m.timestamp === undefined) return "upcoming";
  // Jour connu sans heure : à venir toute la journée, en retard le lendemain.
  if (m.timeTbd) return dayKey(m.timestamp) >= dayKey(now) ? "upcoming" : "stale";
  if (m.timestamp > now) return "upcoming";
  return now - m.timestamp < 5 * 3600 ? "live" : "stale";
}

/** Une compétition d'un autre jeu du même wiki (Call of Duty Mobile, Warzone…). */
export function isOtherTitle(wiki: GameId, ...labels: (string | undefined)[]): boolean {
  const re = OTHER_TITLES[wiki];
  return Boolean(re && labels.some((l) => l && re.test(l)));
}

/** L'équipe suivie qui dispute d'habitude cette compétition, d'après sa règle de surveillance. */
export function watchingTeam(teams: FollowedTeam[], wiki: GameId, page: string, tier?: string): FollowedTeam | undefined {
  return teams.find((f) => {
    const w = f.watch;
    if (f.game !== wiki || !w) return false;
    if (w.exclude?.some((r) => r.test(page))) return false;
    return Boolean(w.pages?.some((r) => r.test(page)) || (tier && w.tiers?.includes(tier)));
  });
}

/**
 * L'équipe suivie concernée par une compétition : celle qui y figure
 * (participants, matchs, classements), sinon la première de ce jeu.
 */
export function teamIn(teams: FollowedTeam[], t: Tournament): FollowedTeam | undefined {
  const ofGame = teams.filter((f) => f.game === t.wiki);
  if (ofGame.length <= 1) return ofGame[0];
  const present = (f: FollowedTeam) =>
    (t.participants ?? []).some((p) => isTeam(p, f)) ||
    tournamentMatches(t).some((m) => m.opponents.some((o) => isTeam(o, f))) ||
    t.stages.some((s) => s.blocks.some((b) => b.kind === "group" && b.table.rows.some((r) => isTeam(r.team, f))));
  return ofGame.find(present) ?? ofGame[0];
}

/** Un match vu du côté de l'équipe suivie : elle est toujours à gauche. */
export interface Oriented {
  match: Match;
  team: FollowedTeam;
  us: TeamRef;
  them: TeamRef | null;
  usScore: string | null;
  themScore: string | null;
  result?: "win" | "loss" | "draw";
}

export function orient(match: Match, team: FollowedTeam): Oriented {
  const i = isTeam(match.opponents[1], team) && !isTeam(match.opponents[0], team) ? 1 : 0;
  const j = 1 - i;
  const winner = match.winner;
  const result = !match.finished ? undefined : winner === undefined ? "draw" : winner === i + 1 ? "win" : "loss";
  return {
    match,
    team,
    us: match.opponents[i] ?? { name: team.page, page: team.page },
    them: match.opponents[j],
    usScore: match.scores[i],
    themScore: match.scores[j],
    result,
  };
}

/** Mêmes adversaires à moins de 3 h d'écart : un match reprogrammé reste le même match. */
export function sameMatch(a: Match, b: Match): boolean {
  if (a.id === b.id) return true;
  if (a.wiki !== b.wiki || a.timestamp === undefined || b.timestamp === undefined) return false;
  if (Math.abs(a.timestamp - b.timestamp) > 3 * 3600) return false;
  return (
    (sameTeam(a.opponents[0], b.opponents[0]) && sameTeam(a.opponents[1], b.opponents[1])) ||
    (sameTeam(a.opponents[0], b.opponents[1]) && sameTeam(a.opponents[1], b.opponents[0]))
  );
}

export function findTournament(snap: Snapshot, wiki: GameId, page?: string): Tournament | undefined {
  if (!page) return undefined;
  return snap.tournaments[`${wiki}:${page}`];
}

/**
 * La page d'équipe donne les streams ; la page de compétition donne le format
 * (Bo), le tour et les manches. Pour l'horaire et le score, la compétition fait
 * foi : Liquipedia ne réactualise pas la page d'équipe quand un match est
 * reprogrammé, alors que la page de compétition, qui le définit, l'est aussitôt.
 */
function enrich(snap: Snapshot, m: Match): Match {
  const t = findTournament(snap, m.wiki, m.tournament?.page);
  const twin = t && tournamentMatches(t).find((x) => sameMatch(x, m));
  if (!twin) return m;
  // Adversaires et scores viennent ensemble de la compétition : l'ordre peut y être inversé.
  const opponents = twin.opponents.map((o) => {
    const mine = m.opponents.find((x) => sameTeam(x, o));
    return o ? { ...o, logo: o.logo ?? mine?.logo, short: o.short ?? mine?.short } : o;
  }) as Match["opponents"];
  return {
    ...m,
    opponents,
    timestamp: twin.timestamp ?? m.timestamp,
    timeTbd: twin.timestamp !== undefined ? twin.timeTbd : m.timeTbd,
    finished: twin.finished || m.finished,
    scores: twin.scores,
    winner: twin.winner,
    bestOf: m.bestOf ?? twin.bestOf,
    round: m.round ?? twin.round,
    games: m.games.length ? m.games : twin.games,
    streams: m.streams.length ? m.streams : twin.streams,
    tournament: { ...twin.tournament, ...m.tournament, name: m.tournament?.name ?? twin.tournament?.name ?? "" },
  };
}

export function upcomingFeed(snap: Snapshot, game?: GameId): Oriented[] {
  const teams = teamsOf(snap);
  const out: Oriented[] = [];
  const seen = new Set<string>();
  for (const team of teams) {
    if (game && team.game !== game) continue;
    for (const m of snap.teams[team.id]?.upcoming ?? []) {
      if (seen.has(m.id) || m.finished) continue;
      seen.add(m.id);
      // La page d'équipe peut encore l'annoncer alors que la compétition l'a déjà terminé :
      // c'est alors un résultat (voir freshResults), plus un match à venir.
      const e = enrich(snap, m);
      if (!e.finished) out.push(orient(e, team));
    }
  }
  // La page d'équipe n'affiche que cinq matchs : les compétitions suivies
  // connaissent souvent la suite du programme.
  for (const t of Object.values(snap.tournaments)) {
    if (t.participating === false || (game && t.wiki !== game)) continue;
    for (const m of tournamentMatches(t)) {
      const team = teams.find((f) => f.game === t.wiki && m.opponents.some((o) => isTeam(o, f)));
      if (!team || m.finished || seen.has(m.id)) continue;
      // Sans date, on ne garde que les affiches connues (pas « M8 contre le vainqueur de… »).
      if (m.timestamp === undefined && !m.opponents.every(Boolean)) continue;
      if (out.some((o) => sameMatch(o.match, m))) continue;
      seen.add(m.id);
      out.push(orient(m, team));
    }
  }
  return out.sort((a, b) => (a.match.timestamp ?? Infinity) - (b.match.timestamp ?? Infinity));
}

export interface PastMatch {
  team: FollowedTeam;
  timestamp: number;
  opponent: TeamRef | null;
  usScore: string;
  themScore: string;
  result: "win" | "loss" | "draw";
  tournament: TournamentRef;
  /** Le match tel que la compétition le décrit (manches, streams), quand on le connaît : il a sa page. */
  matchId?: string;
}

const toPast = (team: FollowedTeam, r: RecentMatch): PastMatch => ({
  team,
  timestamp: r.timestamp,
  opponent: r.opponent,
  usScore: r.score[0],
  themScore: r.score[1],
  result: r.result,
  tournament: r.tournament,
});

const samePast = (a: PastMatch, b: PastMatch) => Math.abs(a.timestamp - b.timestamp) < 3 * 3600 && sameTeam(a.opponent, b.opponent);

/**
 * Résultats que les compétitions suivies connaissent déjà, mais pas encore la
 * page de l'équipe : Liquipedia met à jour la page de compétition pendant le
 * match, la liste « Recent Matches » de l'équipe parfois des heures après.
 * Seulement les matchs postérieurs au dernier résultat de cette liste.
 */
function freshResults(snap: Snapshot, team: FollowedTeam): PastMatch[] {
  const known = snap.teams[team.id]?.recent ?? [];
  const after = Math.max(0, ...known.map((r) => r.timestamp)) - 3 * 3600;
  const out: PastMatch[] = [];
  for (const t of Object.values(snap.tournaments)) {
    if (t.wiki !== team.game || t.participating === false) continue;
    for (const m of tournamentMatches(t)) {
      if (!m.finished || m.timestamp === undefined || m.timestamp < after) continue;
      if (!m.opponents.some((o) => isTeam(o, team))) continue;
      const o = orient(m, team);
      if (!o.result || o.usScore === null || o.themScore === null) continue;
      const past: PastMatch = {
        team,
        timestamp: m.timestamp,
        opponent: o.them,
        usScore: o.usScore,
        themScore: o.themScore,
        result: o.result,
        tournament: m.tournament ?? { name: t.name, page: t.page },
        matchId: m.id,
      };
      if (out.some((x) => samePast(x, past)) || known.some((r) => samePast(toPast(team, r), past))) continue;
      out.push(past);
    }
  }
  return out;
}

export function recentFeed(snap: Snapshot, game?: GameId): PastMatch[] {
  const out: PastMatch[] = [];
  for (const team of teamsOf(snap)) {
    if (game && team.game !== game) continue;
    out.push(...freshResults(snap, team));
    for (const r of snap.teams[team.id]?.recent ?? []) {
      const past = toPast(team, r);
      out.push({ ...past, matchId: twinMatch(snap, past)?.id });
    }
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

/** Le match de compétition qui correspond à un résultat de la page d'équipe (mêmes adversaires, à 3 h près). */
function twinMatch(snap: Snapshot, past: PastMatch): Match | undefined {
  for (const t of Object.values(snap.tournaments)) {
    if (t.wiki !== past.team.game || t.participating === false) continue;
    for (const m of tournamentMatches(t)) {
      if (!m.finished || m.timestamp === undefined || Math.abs(m.timestamp - past.timestamp) > 3 * 3600) continue;
      if (m.opponents.some((o) => isTeam(o, past.team)) && m.opponents.some((o) => sameTeam(o, past.opponent))) return m;
    }
  }
  return undefined;
}

/** Tous les résultats connus d'une équipe : historique accumulé et derniers résultats, sans doublon. */
export function historyOf(snap: Snapshot, team: FollowedTeam): PastMatch[] {
  const all = [...(snap.teams[team.id]?.recent ?? []), ...(snap.history?.[team.id] ?? [])];
  const out: PastMatch[] = freshResults(snap, team);
  for (const r of all) {
    const past = toPast(team, r);
    if (!out.some((x) => samePast(x, past))) out.push(past);
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

export interface HeadToHead {
  wins: number;
  losses: number;
  draws: number;
  meetings: PastMatch[];
}

/** Toutes les rencontres connues : historique de l'équipe et matchs des compétitions suivies. */
export function headToHead(snap: Snapshot, team: FollowedTeam, opponent: TeamRef | null): HeadToHead {
  const meetings: PastMatch[] = [];
  if (opponent) {
    for (const r of historyOf(snap, team)) if (sameTeam(r.opponent, opponent)) meetings.push(r);
    for (const t of Object.values(snap.tournaments)) {
      if (t.wiki !== team.game) continue;
      for (const m of tournamentMatches(t)) {
        if (!m.finished || m.timestamp === undefined) continue;
        const o = orient(m, team);
        if (!isTeam(o.us, team) || !sameTeam(o.them, opponent)) continue;
        if (meetings.some((x) => Math.abs(x.timestamp - m.timestamp!) < 3 * 3600)) continue;
        meetings.push({
          team,
          timestamp: m.timestamp,
          opponent: o.them,
          usScore: o.usScore ?? "",
          themScore: o.themScore ?? "",
          result: o.result ?? "draw",
          tournament: m.tournament ?? { name: t.name, page: t.page },
        });
      }
    }
  }
  meetings.sort((a, b) => b.timestamp - a.timestamp);
  return {
    wins: meetings.filter((m) => m.result === "win").length,
    losses: meetings.filter((m) => m.result === "loss").length,
    draws: meetings.filter((m) => m.result === "draw").length,
    meetings,
  };
}

/** Bilan contre chaque adversaire rencontré, pour la page équipe. */
export function opponentsRecord(snap: Snapshot, team: FollowedTeam) {
  const byOpp = new Map<string, { opponent: TeamRef; h2h: HeadToHead }>();
  for (const r of historyOf(snap, team)) {
    if (!r.opponent) continue;
    const key = norm(r.opponent.page ?? r.opponent.name);
    if (!byOpp.has(key)) byOpp.set(key, { opponent: r.opponent, h2h: headToHead(snap, team, r.opponent) });
  }
  return [...byOpp.values()].sort(
    (a, b) => b.h2h.meetings.length - a.h2h.meetings.length || b.h2h.meetings[0].timestamp - a.h2h.meetings[0].timestamp,
  );
}

export interface Tracked {
  tournament: Tournament;
  team: FollowedTeam;
  /** « upcoming » : inscrite, pas encore commencée et sans match programmé. */
  state: "live" | "running" | "upcoming" | "finished";
  next?: Oriented;
  last?: Oriented;
  standing?: { table: string; row: StandingRow; size: number };
}

export function trackedTournaments(snap: Snapshot, now: number, game?: GameId): Tracked[] {
  const teams = teamsOf(snap);
  const out: Tracked[] = [];
  const today = new Date(now * 1000).toISOString().slice(0, 10);
  for (const t of Object.values(snap.tournaments)) {
    if (game && t.wiki !== game) continue;
    // Connue par la liste du jeu, sans équipe suivie : elle n'a sa place qu'au calendrier.
    if (t.participating === false) continue;
    const team = teamIn(teams, t);
    if (!team) continue;
    const all = tournamentMatches(t);
    const ours = all.filter((m) => m.opponents.some((o) => isTeam(o, team))).map((m) => orient(m, team));
    const fromTeamPage = upcomingFeed(snap, t.wiki).filter((o) => o.team.id === team.id && o.match.tournament?.page === t.page);

    const unplayed = ours.filter((o) => !o.match.finished);
    const pending = [...unplayed, ...fromTeamPage.filter((o) => !unplayed.some((u) => sameMatch(u.match, o.match)))]
      .filter((o) => statusOf(o.match, now) !== "stale")
      .sort((a, b) => (a.match.timestamp ?? Infinity) - (b.match.timestamp ?? Infinity));
    const done = ours
      .filter((o) => o.match.finished && o.match.timestamp !== undefined)
      .sort((a, b) => b.match.timestamp! - a.match.timestamp!);

    let standing: Tracked["standing"];
    for (const s of t.stages)
      for (const b of s.blocks)
        if (b.kind === "group") {
          const row = b.table.rows.find((r) => isTeam(r.team, team));
          // Avant le premier match, le rang est vide : rien à montrer.
          if (row && /^[1-9]\d*$/.test(row.rank)) standing = { table: b.table.title, row, size: b.table.rows.length };
        }

    const live = all.some((m) => statusOf(m, now) === "live") || pending.some((o) => statusOf(o.match, now) === "live");
    const running = pending.length > 0 || all.some((m) => !m.finished && statusOf(m, now) !== "stale");
    const upcoming = !done.length && (t.startDate ?? "") > today;
    out.push({
      tournament: t,
      team,
      state: live ? "live" : upcoming ? "upcoming" : running ? "running" : "finished",
      next: pending[0],
      last: done[0],
      standing,
    });
  }
  const rank = { live: 0, running: 1, upcoming: 2, finished: 3 };
  return out.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] ||
      (a.next?.match.timestamp ?? Infinity) - (b.next?.match.timestamp ?? Infinity) ||
      (a.tournament.startDate ?? "").localeCompare(b.tournament.startDate ?? "") ||
      (b.last?.match.timestamp ?? 0) - (a.last?.match.timestamp ?? 0),
  );
}

/** Un match de mes équipes est en cours ou commence dans les dix minutes : le site se rafraîchit seul. */
export function liveSoon(snap: Snapshot, now: number): boolean {
  return upcomingFeed(snap).some(
    (o) =>
      statusOf(o.match, now) === "live" ||
      (!o.match.timeTbd && o.match.timestamp !== undefined && o.match.timestamp - now < 10 * 60 && o.match.timestamp > now),
  );
}

export function competitionHref(wiki: GameId, page: string, anchor?: string): string {
  const path = page
    .split("/")
    .map((seg) => encodeURIComponent(seg.replace(/ /g, "_")))
    .join("/");
  return `/competition/${wiki}/${path}${anchor ? `#${encodeURIComponent(anchor.replace(/ /g, "_"))}` : ""}`;
}

/** Adresse de la page d'un match. */
export const matchHref = (m: Match) => `/match/${encodeURIComponent(m.id)}`;

/**
 * Un match de mes équipes, retrouvé par son identifiant : à venir (page
 * d'équipe complétée par la compétition), ou dans une compétition suivie,
 * terminé ou non. Vu du côté de l'équipe suivie.
 */
export function findMatch(snap: Snapshot, id: string): { o: Oriented; tournament?: Tournament } | undefined {
  const teams = teamsOf(snap);
  for (const team of teams)
    for (const m of snap.teams[team.id]?.upcoming ?? [])
      if (m.id === id) {
        const e = enrich(snap, m);
        return { o: orient(e, team), tournament: findTournament(snap, e.wiki, e.tournament?.page) };
      }
  for (const t of Object.values(snap.tournaments)) {
    if (t.participating === false) continue;
    for (const m of tournamentMatches(t)) {
      if (m.id !== id) continue;
      const team = teams.find((f) => f.game === t.wiki && m.opponents.some((o) => isTeam(o, f)));
      if (team) return { o: orient(m, team), tournament: t };
    }
  }
  return undefined;
}

/**
 * Adversaires des matchs des 7 prochains jours (8 au plus), dont la page
 * Liquipedia est connue : la synchro lit leur fiche une fois par jour pour
 * leur effectif et leur forme. Une équipe suivie a déjà la sienne.
 */
export function upcomingOpponents(snap: Snapshot, now = Date.now() / 1000, days = 7, max = 8) {
  const teams = teamsOf(snap);
  const out = new Map<string, { wiki: GameId; page: string; name: string }>();
  for (const o of upcomingFeed(snap)) {
    const them = o.them;
    if (!them?.page || o.match.timestamp === undefined || o.match.timestamp > now + days * 86400) continue;
    if (teams.some((f) => f.game === o.match.wiki && isTeam(them, f))) continue;
    out.set(`${o.match.wiki}:${them.page}`, { wiki: o.match.wiki, page: them.page, name: them.name });
    if (out.size >= max) break;
  }
  return [...out.values()];
}

export const opponentKey = (wiki: GameId, page: string) => `${wiki}:${page}`;

export type Outcome = "win" | "loss" | "draw";

export interface Form {
  /** Derniers résultats, du plus récent au plus ancien. */
  last: Outcome[];
  wins: number;
  losses: number;
  draws: number;
  /** Série en cours : le dernier résultat et combien de fois de suite. */
  streak?: { result: Outcome; count: number };
}

/** Forme du moment sur les `n` derniers résultats (déjà triés du plus récent au plus ancien). */
export function formOf(results: { result: Outcome }[], n = 10): Form {
  const last = results.slice(0, n).map((r) => r.result);
  let count = 0;
  while (count < last.length && last[count] === last[0]) count++;
  return {
    last,
    wins: last.filter((r) => r === "win").length,
    losses: last.filter((r) => r === "loss").length,
    draws: last.filter((r) => r === "draw").length,
    streak: last.length ? { result: last[0], count } : undefined,
  };
}

/**
 * Le score final d'un match pronostiqué, vu de l'équipe suivie : par
 * l'identifiant du match s'il est terminé, sinon dans les résultats de
 * l'équipe (même adversaire, à deux jours près : un match reporté reste le
 * même). Rien tant que le match n'est pas joué.
 */
export function predictionResult(snap: Snapshot, id: string, p: Prediction): { us: number; them: number } | undefined {
  const toScore = (a: string | null | undefined, b: string | null | undefined) => {
    const us = Number(a);
    const them = Number(b);
    return a && b && Number.isFinite(us) && Number.isFinite(them) ? { us, them } : undefined;
  };
  const found = findMatch(snap, id);
  if (found?.o.match.finished) return toScore(found.o.usScore, found.o.themScore);
  const team = teamById(snap, p.teamId);
  if (!team || p.timestamp === undefined) return undefined;
  const near = historyOf(snap, team)
    .filter((r) => sameTeam(r.opponent, { name: p.opponent.name, page: p.opponent.page }) && Math.abs(r.timestamp - p.timestamp!) < 2 * 86400)
    .sort((a, b) => Math.abs(a.timestamp - p.timestamp!) - Math.abs(b.timestamp - p.timestamp!))[0];
  return near ? toScore(near.usScore, near.themScore) : undefined;
}

/** La place d'une équipe dans le classement de saison de son jeu, s'il y en a un. */
export function rankOf(snap: Snapshot, wiki: GameId, team: TeamRef | null | undefined): RankingRow | undefined {
  if (!team) return undefined;
  return snap.rankings?.[wiki]?.rows.find((r) => sameTeam(r.team, team));
}

/** « 2e », « 1er » : un rang à la française. */
export const ordinal = (n: number) => `${n}${n === 1 ? "er" : "e"}`;

/**
 * Adresse de la page d'une équipe : la page complète pour une équipe suivie,
 * sinon sa fiche (`/equipes/<jeu>/<page Liquipedia>`). Rien sans page connue.
 */
export function teamPath(snap: Snapshot, wiki: GameId, ref: TeamRef | null | undefined): string | undefined {
  if (!ref) return undefined;
  const followed = teamsOf(snap).find((f) => f.game === wiki && isTeam(ref, f));
  if (followed) return `/equipe/${followed.id}`;
  return ref.page ? fichePath(wiki, ref.page) : undefined;
}

/** Adresse de la fiche d'une équipe non suivie. */
export const fichePath = (wiki: GameId, page: string) =>
  `/equipes/${wiki}/${page.split("/").map((seg) => encodeURIComponent(seg.replace(/ /g, "_"))).join("/")}`;

/** Lien d'une équipe vu d'une page de compétition : l'équipe suivie vers sa page, les autres vers leur fiche. */
export function teamLink(wiki: GameId, ref: TeamRef | null | undefined, team: FollowedTeam): string | undefined {
  if (!ref) return undefined;
  if (isTeam(ref, team)) return `/equipe/${team.id}`;
  return ref.page ? fichePath(wiki, ref.page) : undefined;
}

/** Nom, logo et sigle d'une équipe, d'après tout ce que l'instantané en connaît. */
export function findTeamRef(snap: Snapshot, wiki: GameId, page: string): TeamRef | undefined {
  const target: TeamRef = { name: page, page };
  const opp = snap.opponents?.[opponentKey(wiki, page)];
  const seen: TeamRef[] = [];
  if (opp) seen.push({ name: opp.name, page: opp.page, logo: opp.logo });
  for (const r of snap.rankings?.[wiki]?.rows ?? []) seen.push(r.team);
  for (const t of Object.values(snap.tournaments)) {
    if (t.wiki !== wiki) continue;
    seen.push(...(t.participants ?? []));
    for (const m of tournamentMatches(t)) for (const o of m.opponents) if (o) seen.push(o);
    for (const s of t.stages) for (const b of s.blocks) if (b.kind === "group") for (const r of b.table.rows) if (r.team) seen.push(r.team);
  }
  const same = seen.filter((r) => sameTeam(r, target));
  if (!same.length) return undefined;
  return {
    name: same.find((r) => r.name && r.name !== page)?.name ?? same[0].name,
    page,
    short: same.find((r) => r.short)?.short,
    logo: same.find((r) => r.logo)?.logo,
  };
}

/** Les matchs d'une équipe dans les compétitions suivies, du plus récent au plus ancien. */
export function teamMatches(snap: Snapshot, wiki: GameId, ref: TeamRef): { match: Match; tournament: Tournament }[] {
  const out: { match: Match; tournament: Tournament }[] = [];
  for (const t of Object.values(snap.tournaments)) {
    if (t.wiki !== wiki || t.participating === false) continue;
    for (const m of tournamentMatches(t)) if (m.opponents.some((o) => sameTeam(o, ref))) out.push({ match: m, tournament: t });
  }
  return out.sort((a, b) => (b.match.timestamp ?? 0) - (a.match.timestamp ?? 0));
}

/** Sa place dans les classements de poule des compétitions suivies. */
export function teamStandings(snap: Snapshot, wiki: GameId, ref: TeamRef) {
  const out: { tournament: Tournament; table: string; row: StandingRow; size: number }[] = [];
  for (const t of Object.values(snap.tournaments)) {
    if (t.wiki !== wiki || t.participating === false) continue;
    for (const s of t.stages)
      for (const b of s.blocks) {
        if (b.kind !== "group") continue;
        const row = b.table.rows.find((r) => sameTeam(r.team, ref));
        if (row) out.push({ tournament: t, table: b.table.title, row, size: b.table.rows.length });
      }
  }
  return out;
}
