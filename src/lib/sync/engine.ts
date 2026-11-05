/**
 * Moteur de synchronisation avec Liquipedia, partagé par :
 *   - scripts/refresh.ts : en local (`npm run sync`, `npm run dev`) et dans
 *     GitHub Actions (passe planifiée, profil « ci ») ;
 *   - src/lib/sync/auto.ts : le secours et le mode « match en cours » qui
 *     tournent sur Vercel quand on ouvre le site (profil « visit »).
 *
 * Une passe enchaîne les tâches les plus urgentes, une à la fois. Le rythme des
 * appels est tenu par le client ; ici on décide seulement quoi relire et quand.
 */
import { GAME_IDS, IGNORE_TOURNAMENTS, SEASON_PREFIXES, TIER_LISTS, type TeamConfig, toFollowed } from "../../config/follow";
import { isTeam, watchingTeam } from "../derive";
import { LiquipediaError, leadSections, listPages, pageExists, parsePage, queryWikitext } from "../liquipedia/client";
import { parseListing } from "../liquipedia/listing";
import { parsePortal } from "../liquipedia/portal";
import { parseMatchHistory, parseTeamPage } from "../liquipedia/team-page";
import { parseTournamentPage } from "../liquipedia/tournament-page";
import { tournamentKey } from "../snapshot";
import { tournamentMatches } from "../tournament";
import type { GameId, Match, PortalEntry, RecentMatch, Snapshot, Tournament } from "../types";
import type { FollowedTeam } from "../../config/follow";

export type Profile = "local" | "ci" | "visit" | "cron";

export interface PassOptions {
  profile: Profile;
  /** Les équipes suivies : réglages du site, sinon valeurs par défaut. */
  teams: TeamConfig[];
  maxPages?: number;
  /** Relire chaque page une fois, même à jour. */
  force?: boolean;
  /** Mode « match en cours » : seulement les équipes qui jouent et leurs compétitions. */
  onlyLive?: boolean;
  log?: (...args: unknown[]) => void;
  /** Appelé après chaque tâche (écrire l'instantané sur disque, par exemple). */
  afterTask?: (snap: Snapshot) => void;
  /** Heure (ms) après laquelle ne plus commencer de page : une fonction Vercel doit garder le temps de publier. */
  deadline?: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Délais avant de relire une page, selon le profil. */
function ttls(profile: Profile) {
  // Le cron externe et les visites repassent toutes les 4-5 minutes : pendant un match, chaque passe relit le score.
  const frequent = profile === "visit" || profile === "cron";
  return {
    team: profile === "local" ? 30 * MIN : 28 * MIN,
    /** Page d'équipe quand elle joue dans les trois heures (ou joue) : on suit le score. */
    teamLive: frequent ? 4 * MIN : 12 * MIN,
    live: frequent ? 4 * MIN : profile === "ci" ? 12 * MIN : 10 * MIN,
    active: 3 * HOUR,
    /** Pas encore commencée, une équipe suivie inscrite. */
    planned: 12 * HOUR,
    /** Sans équipe suivie : seules ses dates servent, au calendrier. */
    outsider: DAY,
    portal: 6 * HOUR,
    listing: DAY,
    season: DAY,
    history: 7 * DAY,
    failure: 15 * MIN,
    missing: DAY,
  };
}

/** Une compétition jouée par une équipe suivie reste suivie trois semaines. */
const RECENT_WINDOW_S = 21 * 24 * 3600;
/** Une compétition surveillée est lue en détail dans les 45 jours qui précèdent son début. */
const WATCH_HORIZON_DAYS = 45;
const MAX_TOURNAMENTS = 30;
/** Taille maximale de l'historique gardé par équipe. */
const MAX_HISTORY = 400;

const ageOf = (iso?: string) => (iso ? Date.now() - Date.parse(iso) : Infinity);
const nowS = () => Date.now() / 1000;
const today = () => new Date().toISOString().slice(0, 10);

interface Task {
  key: string;
  label: string;
  priority: number;
  staleness: number;
  run: (snap: Snapshot) => Promise<string>;
}

interface Discovered {
  wiki: GameId;
  page: string;
  /** « team » : la page d'une équipe suivie y renvoie ; « portal » : une liste seulement. */
  origin: "team" | "portal";
}

/** Un match de l'équipe se joue dans les trois heures, ou se joue. */
function playingSoon(snap: Snapshot, team: FollowedTeam): boolean {
  const now = nowS();
  return (snap.teams[team.id]?.upcoming ?? []).some(
    (m) => !m.finished && m.timestamp !== undefined && !m.timeTbd && m.timestamp - now < 3 * 3600 && now - m.timestamp < 5 * 3600,
  );
}

/**
 * Compétitions à lire : celles où jouent les équipes suivies (matchs à venir,
 * puis résultats récents), celles à venir ou en cours de la liste de chaque
 * jeu, et les grandes compétitions surveillées qui approchent.
 */
function discover(snap: Snapshot, teams: FollowedTeam[]): Map<string, Discovered> {
  const out = new Map<string, Discovered>();
  const add = (wiki: GameId, origin: Discovered["origin"], page?: string, name?: string) => {
    if (!page || out.size >= MAX_TOURNAMENTS) return;
    if (IGNORE_TOURNAMENTS.some((r) => r.test(page) || (name !== undefined && r.test(name)))) return;
    const key = tournamentKey(wiki, page);
    if (!out.has(key)) out.set(key, { wiki, page, origin });
  };
  for (const team of teams)
    for (const m of snap.teams[team.id]?.upcoming ?? []) add(team.game, "team", m.tournament?.page, m.tournament?.name);
  for (const team of teams)
    for (const r of snap.teams[team.id]?.recent ?? [])
      if (nowS() - r.timestamp < RECENT_WINDOW_S) add(team.game, "team", r.tournament.page, r.tournament.name);
  const games = new Set(teams.map((t) => t.game));
  for (const wiki of GAME_IDS)
    if (games.has(wiki))
      for (const e of snap.portals?.[wiki]?.entries ?? []) if (e.status !== "completed") add(wiki, "portal", e.page, e.name);
  const horizon = new Date(Date.now() + WATCH_HORIZON_DAYS * DAY).toISOString().slice(0, 10);
  for (const listing of Object.values(snap.listings ?? {}))
    for (const e of listing.entries)
      if (e.status !== "completed" && (e.startDate ?? "9999") <= horizon && watchingTeam(teams, e.wiki, e.page, e.tier))
        add(e.wiki, "portal", e.page, e.name);
  return out;
}

function tournamentState(t: Tournament, snap: Snapshot, teams: FollowedTeam[]): "live" | "active" | "planned" | "done" {
  const now = nowS();
  const followed = teams.flatMap((f) => snap.teams[f.id]?.upcoming ?? []).filter((m) => m.tournament?.page === t.page);
  const soon = (m: Match) => m.timestamp !== undefined && m.timestamp - now < 3 * 3600 && now - m.timestamp < 6 * 3600;
  const matches = tournamentMatches(t);
  if (followed.some(soon) || matches.some((m) => !m.finished && soon(m))) return "live";
  if (followed.length || matches.some((m) => !m.finished)) return "active";
  if (matches.some((m) => m.timestamp !== undefined && now - m.timestamp < 2 * 86400)) return "active";
  // Pas encore commencée (ou sans matchs programmés) : à relire de temps en temps.
  if ((t.endDate ?? t.startDate ?? "") >= today()) return "planned";
  return "done";
}

/** Une équipe suivie y joue : inscrite, présente dans un match ou un classement, ou annoncée par sa propre page. */
function involvesFollowed(t: Tournament, origin: Discovered["origin"], teams: FollowedTeam[]): boolean {
  if (origin === "team") return true;
  const ofGame = teams.filter((f) => f.game === t.wiki);
  const inStandings = t.stages.some((s) =>
    s.blocks.some((b) => b.kind === "group" && b.table.rows.some((r) => ofGame.some((f) => isTeam(r.team, f)))),
  );
  return (
    inStandings ||
    (t.participants ?? []).some((p) => ofGame.some((f) => isTeam(p, f))) ||
    tournamentMatches(t).some((m) => m.opponents.some((o) => ofGame.some((f) => isTeam(o, f))))
  );
}

/** Ajoute des résultats à l'historique d'une équipe, sans doublon (même adversaire à moins de 3 h). */
function mergeHistory(snap: Snapshot, teamId: string, rows: RecentMatch[]): number {
  const history = [...(snap.history?.[teamId] ?? [])];
  let added = 0;
  for (const r of rows) {
    const key = (r.opponent?.page ?? r.opponent?.name ?? "").toLowerCase();
    const dup = history.some(
      (h) => Math.abs(h.timestamp - r.timestamp) < 3 * 3600 && (h.opponent?.page ?? h.opponent?.name ?? "").toLowerCase() === key,
    );
    if (dup) continue;
    history.push(r);
    added++;
  }
  history.sort((a, b) => b.timestamp - a.timestamp);
  snap.history = { ...snap.history, [teamId]: history.slice(0, MAX_HISTORY) };
  return added;
}

const TIER_BY_NUMBER: Record<string, string> = { "1": "S-Tier", "2": "A-Tier", "3": "B-Tier", "4": "C-Tier", "5": "D-Tier" };

/**
 * Compétitions de la saison en cours d'un circuit : on repère le numéro (ou
 * l'année) le plus récent, on liste ses pages, puis on lit nom, dates et niveau
 * dans leurs infobox, en quelques requêtes légères.
 */
async function readSeasons(wiki: GameId, onWait: (ms: number) => void): Promise<PortalEntry[]> {
  const entries: PortalEntry[] = [];
  for (const pattern of SEASON_PREFIXES[wiki]) {
    const [head, tail] = pattern.split("{N}");
    const numbers = (await listPages(wiki, head, true, onWait))
      .map((t) => Number(t.slice(head.length).match(/^(\d+)/)?.[1]))
      .filter((n) => Number.isFinite(n) && n > 0);
    let latest = numbers.length ? Math.max(...numbers) : new Date().getUTCFullYear();
    // Une saison plus récente encore absente des 500 premiers titres (« Season 10 » après « Season 9 »).
    while ((await listPages(wiki, `${head}${latest + 1}${tail}`, false, onWait)).length) latest++;
    const prefix = `${head}${latest}${tail}`;
    const pages = (await listPages(wiki, prefix, false, onWait)).filter(
      (t) => !/Additional Content|Signings|Transfers|Statistics|Broadcast|Rosters?$|Standings?$|Points$|Rankings?$/i.test(t),
    );
    if (!pages.length) continue;
    const leads = await leadSections(wiki, pages, onWait);
    for (const [title, wikitext] of leads) {
      const field = (k: string) => wikitext.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^|\\n}]*)`))?.[1]?.trim() || undefined;
      const start = field("sdate") ?? field("date");
      if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) continue;
      const endRaw = field("edate");
      const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : start;
      entries.push({
        wiki,
        page: title,
        name: field("name") ?? title.slice(head.length),
        status: end < today() ? "completed" : start > today() ? "upcoming" : "ongoing",
        startDate: start,
        endDate: end,
        location: field("city") ?? field("location"),
        tier: TIER_BY_NUMBER[field("liquipediatier") ?? ""],
      });
    }
  }
  // Les phases d'une compétition sont des sous-pages dont les dates tiennent dans
  // celles de leur parent (« …/Europe/Swiss Group B ») : on ne garde que la
  // compétition. Une sous-page à d'autres dates est une compétition à part
  // (« Kick-Off/Europe », qualification du « Kick-Off » de Londres).
  const isStage = (e: PortalEntry) =>
    entries.some(
      (p) =>
        p !== e && e.page.startsWith(`${p.page}/`) && p.startDate! <= e.startDate! && e.endDate! <= p.endDate!,
    );
  return entries.filter((e) => e.status !== "completed" && !isStage(e));
}

function plan(snap: Snapshot, teams: FollowedTeam[], opts: PassOptions, done: Set<string>): Task[] {
  const t = ttls(opts.profile);
  const tasks: Task[] = [];
  const log = opts.log ?? (() => {});
  const onWait = (ms: number) => {
    if (ms > 3000) log(`⏳ ${Math.ceil(ms / 1000)} s avant l'appel suivant (Liquipedia : 1 page toutes les 30 s)`);
  };
  const forced = (key: string) => Boolean(opts.force && !done.has(key));
  const failedRecently = (key: string) => {
    const f = snap.failures[key];
    if (!f) return false;
    return ageOf(f.at) < (/missingtitle|invalidtitle/.test(f.message) ? t.missing : t.failure);
  };
  const live = new Set(teams.filter((team) => playingSoon(snap, team)).map((team) => team.id));

  for (const team of teams) {
    const key = `team:${team.id}`;
    const current = snap.teams[team.id];
    const age = ageOf(current?.fetchedAt);
    const ttl = live.has(team.id) ? t.teamLive : t.team;
    if (opts.onlyLive && !live.has(team.id)) continue;
    if ((!forced(key) && age < ttl) || failedRecently(key)) continue;
    tasks.push({
      key,
      label: `équipe ${team.page} (${team.game})${live.has(team.id) ? " · en direct" : ""}`,
      priority: current ? (live.has(team.id) ? 1.2 : 2) : 0,
      staleness: age,
      run: async (s) => {
        const page = await parsePage(team.game, team.page, onWait);
        const parsed = parseTeamPage(page.html, team);
        s.teams[team.id] = { id: team.id, name: team.page, ...parsed, fetchedAt: new Date().toISOString() };
        mergeHistory(s, team.id, parsed.recent);
        return `${parsed.upcoming.length} à venir, ${parsed.recent.length} récents, ${parsed.roster.length} joueurs`;
      },
    });
  }

  if (!opts.onlyLive) {
    const games = [...new Set(teams.map((team) => team.game))];

    for (const wiki of games) {
      const key = `portal:${wiki}`;
      const age = ageOf(snap.portals?.[wiki]?.fetchedAt);
      if ((!forced(key) && age < t.portal) || failedRecently(key)) continue;
      tasks.push({
        key,
        label: `liste des compétitions (${wiki})`,
        priority: 2.5,
        staleness: age,
        run: async (s) => {
          const entries = parsePortal(await queryWikitext(wiki, "Liquipedia:Tournaments", onWait), wiki);
          s.portals = { ...s.portals, [wiki]: { entries, fetchedAt: new Date().toISOString() } };
          return `${entries.filter((e) => e.status !== "completed").length} à venir ou en cours`;
        },
      });
    }

    for (const wiki of games)
      for (const list of TIER_LISTS[wiki]) {
        const key = `listing:${wiki}:${list}`;
        const age = ageOf(snap.listings?.[`${wiki}:${list}`]?.fetchedAt);
        if ((!forced(key) && age < t.listing) || failedRecently(key)) continue;
        tasks.push({
          key,
          label: `${list} (${wiki})`,
          priority: 2.9,
          staleness: age,
          run: async (s) => {
            const page = await parsePage(wiki, list, onWait);
            const entries = parseListing(page.html, wiki, list, today());
            s.listings = { ...s.listings, [`${wiki}:${list}`]: { entries, fetchedAt: new Date().toISOString() } };
            return `${entries.length} à venir ou en cours`;
          },
        });
      }

    for (const wiki of games) {
      if (!SEASON_PREFIXES[wiki].length) continue;
      const key = `season:${wiki}`;
      const age = ageOf(snap.listings?.[`${wiki}:saisons`]?.fetchedAt);
      if ((!forced(key) && age < t.season) || failedRecently(key)) continue;
      tasks.push({
        key,
        label: `saisons en cours (${wiki})`,
        priority: 2.95,
        staleness: age,
        run: async (s) => {
          const entries = await readSeasons(wiki, onWait);
          s.listings = { ...s.listings, [`${wiki}:saisons`]: { entries, fetchedAt: new Date().toISOString() } };
          return `${entries.length} compétitions à venir ou en cours`;
        },
      });
    }

    for (const team of teams) {
      const key = `history:${team.id}`;
      const age = ageOf(snap.historyFetchedAt?.[team.id]);
      if ((!forced(key) && age < t.history) || failedRecently(key)) continue;
      tasks.push({
        key,
        label: `historique ${team.page} (${team.game})`,
        priority: 3.5,
        staleness: age,
        run: async (s) => {
          // Toutes les équipes n'ont pas de page « /Matches » : on le vérifie d'abord, par une requête légère.
          const title = await pageExists(team.game, `${team.page}/Matches`, onWait);
          let added = 0;
          if (title) added = mergeHistory(s, team.id, parseMatchHistory((await parsePage(team.game, title, onWait)).html));
          s.historyFetchedAt = { ...s.historyFetchedAt, [team.id]: new Date().toISOString() };
          return title ? `${added} matchs ajoutés à l'historique` : "pas de page d'historique : il se construit au fil des résultats";
        },
      });
    }
  }

  for (const [key, ref] of discover(snap, teams)) {
    const current = snap.tournaments[key];
    const state = current ? tournamentState(current, snap, teams) : undefined;
    if (opts.onlyLive && state !== "live") continue;
    if ((!forced(key) && state === "done") || failedRecently(key)) continue;
    const watched = Boolean(watchingTeam(teams, ref.wiki, ref.page, current?.info["Liquipedia Tier"]));
    const ttl =
      current?.participating === false
        ? watched
          ? t.planned
          : t.outsider
        : state === "live"
          ? t.live
          : state === "planned"
            ? t.planned
            : t.active;
    const age = ageOf(current?.fetchedAt);
    if (!forced(key) && current && age < ttl) continue;
    tasks.push({
      key,
      label: `compétition ${ref.page} (${ref.wiki})${state === "live" ? " · en direct" : ""}`,
      // Une compétition découverte par une liste passe après les équipes et les
      // matchs en cours : elle ne doit jamais retarder un score.
      priority: !current ? (ref.origin === "team" ? 1 : 2.8) : state === "live" ? 1.5 : 3,
      staleness: age,
      run: async (s) => {
        const page = await parsePage(ref.wiki, ref.page, onWait);
        const parsed = parseTournamentPage(page.html, ref.wiki, ref.page);
        const tour: Tournament = { key, wiki: ref.wiki, page: ref.page, ...parsed, fetchedAt: new Date().toISOString() };
        tour.participating = involvesFollowed(tour, ref.origin, teams);
        // Sans équipe suivie, seules les dates servent : inutile de garder les phases.
        if (!tour.participating) tour.stages = [];
        s.tournaments[key] = tour;
        const dates = tour.startDate ? ` · ${tour.startDate} → ${tour.endDate ?? "?"}` : "";
        return tour.participating
          ? `${parsed.stages.length} phases, ${tournamentMatches(tour).length} matchs, ${parsed.participants.length} participants${dates}`
          : `aucune équipe suivie (${parsed.participants.length} participants)${dates}`;
      },
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority || b.staleness - a.staleness);
}

/** Oublie ce qui ne concerne plus aucune équipe suivie (compétitions, équipes retirées des réglages). */
function prune(snap: Snapshot, teams: FollowedTeam[]) {
  const ids = new Set(teams.map((t) => t.id));
  for (const id of Object.keys(snap.teams)) if (!ids.has(id)) delete snap.teams[id];
  if (snap.history) for (const id of Object.keys(snap.history)) if (!ids.has(id)) delete snap.history[id];
  if (!teams.every((t) => snap.teams[t.id])) return;
  const keep = discover(snap, teams);
  for (const key of Object.keys(snap.tournaments)) if (!keep.has(key)) delete snap.tournaments[key];
}

export interface PassResult {
  pages: number;
  /** Tâches encore dues à la fin de la passe (limite de pages atteinte). */
  remaining: number;
  /** Liquipedia a refusé les requêtes (403 ou 429). */
  refused: boolean;
}

/** Une passe de synchronisation sur l'instantané donné, modifié en place. */
export async function runPass(snap: Snapshot, opts: PassOptions): Promise<PassResult> {
  const log = opts.log ?? (() => {});
  const teams = opts.teams.map(toFollowed);
  snap.followed = opts.teams;
  const done = new Set<string>();
  const max = opts.maxPages ?? Infinity;
  let pages = 0;
  for (;;) {
    const tasks = plan(snap, teams, opts, done);
    const [task] = tasks;
    if (!task) break;
    const late = opts.deadline !== undefined && Date.now() > opts.deadline;
    if (pages >= max || late) {
      log(`${late ? "Plus le temps" : `Limite de ${max} pages atteinte`} ; ${tasks.length} restent pour la prochaine passe.`);
      snap.checkedAt = new Date().toISOString();
      return { pages, remaining: tasks.length, refused: false };
    }
    log(`↻ ${task.label}…`);
    done.add(task.key);
    pages++;
    try {
      const summary = await task.run(snap);
      delete snap.failures[task.key];
      log(`  ✓ ${summary}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      snap.failures[task.key] = { at: new Date().toISOString(), message };
      log(`  ✗ ${message}`);
      if (e instanceof LiquipediaError && /^http-(403|429)$/.test(e.code)) {
        opts.afterTask?.(snap);
        return { pages, remaining: tasks.length, refused: true };
      }
    }
    prune(snap, teams);
    snap.updatedAt = new Date().toISOString();
    opts.afterTask?.(snap);
  }
  snap.checkedAt = new Date().toISOString();
  opts.afterTask?.(snap);
  return { pages, remaining: 0, refused: false };
}
