/**
 * Synchronisation avec Liquipedia.
 *
 *   npm run sync          une passe : tout ce qui est périmé, puis s'arrête
 *   npm run sync:watch    tourne en continu (lancé aussi par npm run dev)
 *   npm run sync -- --force   recharge tout une fois, même ce qui est à jour
 *   tsx scripts/refresh.ts --ci   la passe planifiée de GitHub Actions (voir plus bas)
 *
 * Une tâche à la fois, la plus urgente d'abord. Le rythme des appels est tenu
 * par le client ; ici on décide seulement quoi rafraîchir et quand.
 */
import { FOLLOWED, IGNORE_TOURNAMENTS } from "../src/config/follow";
import { LiquipediaError, parsePage } from "../src/lib/liquipedia/client";
import { parseTeamPage } from "../src/lib/liquipedia/team-page";
import { parseTournamentPage } from "../src/lib/liquipedia/tournament-page";
import { readSnapshot, tournamentKey, writeSnapshot } from "../src/lib/snapshot";
import { tournamentMatches } from "../src/lib/tournament";
import type { GameId, Match, Snapshot, Tournament } from "../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Pas de .env.local : le contact par défaut du User-Agent s'applique.
}

const watch = process.argv.includes("--watch");
const force = process.argv.includes("--force");
/**
 * Passe planifiée de GitHub Actions, toutes les 15 minutes. Une compétition où
 * une équipe suivie joue est relue à chaque passe, les pages d'équipe une passe
 * sur deux. La passe est bornée : chaque page coûte 31 s d'attente, et une
 * passe doit finir bien avant la suivante.
 */
const ci = process.argv.includes("--ci");

const MIN = 60_000;
const HOUR = 60 * MIN;
const TEAM_TTL = ci ? 28 * MIN : 30 * MIN;
const LIVE_TTL = ci ? 12 * MIN : 10 * MIN;
const ACTIVE_TTL = 3 * HOUR;
const MAX_PAGES = ci ? 6 : Infinity;
/** Une compétition jouée par une équipe suivie reste suivie trois semaines. */
const RECENT_WINDOW_S = 21 * 24 * 3600;
const FAILURE_BACKOFF = 15 * MIN;
const MISSING_BACKOFF = 24 * HOUR;
const MAX_TOURNAMENTS = 14;
const IDLE_POLL = MIN;

/** Avec --force, chaque page est rechargée une fois pendant cette exécution. */
const doneThisRun = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toLocaleTimeString("fr-FR"), ...args);
const ageOf = (iso?: string) => (iso ? Date.now() - Date.parse(iso) : Infinity);
const nowS = () => Date.now() / 1000;

interface Task {
  key: string;
  label: string;
  priority: number;
  staleness: number;
  run: (snap: Snapshot) => Promise<string>;
}

function onWait(ms: number) {
  if (ms > 3000) log(`⏳ ${Math.ceil(ms / 1000)} s avant l'appel suivant (Liquipedia : 1 page toutes les 30 s)`);
}

/** Compétitions où jouent les équipes suivies : matchs à venir d'abord, puis résultats récents. */
function discover(snap: Snapshot): Map<string, { wiki: GameId; page: string }> {
  const out = new Map<string, { wiki: GameId; page: string }>();
  const add = (wiki: GameId, page?: string, name?: string) => {
    if (!page || out.size >= MAX_TOURNAMENTS) return;
    if (IGNORE_TOURNAMENTS.some((r) => r.test(page) || (name !== undefined && r.test(name)))) return;
    out.set(tournamentKey(wiki, page), { wiki, page });
  };
  for (const team of FOLLOWED)
    for (const m of snap.teams[team.id]?.upcoming ?? []) add(team.game, m.tournament?.page, m.tournament?.name);
  for (const team of FOLLOWED)
    for (const r of snap.teams[team.id]?.recent ?? [])
      if (nowS() - r.timestamp < RECENT_WINDOW_S) add(team.game, r.tournament.page, r.tournament.name);
  return out;
}

function tournamentState(t: Tournament, snap: Snapshot): "live" | "active" | "done" {
  const now = nowS();
  const followed = FOLLOWED.flatMap((f) => snap.teams[f.id]?.upcoming ?? []).filter((m) => m.tournament?.page === t.page);
  const soon = (m: Match) => m.timestamp !== undefined && m.timestamp - now < 3 * 3600 && now - m.timestamp < 6 * 3600;
  const matches = tournamentMatches(t);
  if (followed.some(soon) || matches.some((m) => !m.finished && soon(m))) return "live";
  if (followed.length || matches.some((m) => !m.finished)) return "active";
  if (matches.some((m) => m.timestamp !== undefined && now - m.timestamp < 2 * 86400)) return "active";
  return "done";
}

function plan(snap: Snapshot): Task[] {
  const tasks: Task[] = [];
  const failedRecently = (key: string) => {
    const f = snap.failures[key];
    if (!f) return false;
    const backoff = /missingtitle|invalidtitle/.test(f.message) ? MISSING_BACKOFF : FAILURE_BACKOFF;
    return ageOf(f.at) < backoff;
  };

  for (const team of FOLLOWED) {
    const key = `team:${team.id}`;
    const current = snap.teams[team.id];
    const age = ageOf(current?.fetchedAt);
    const forced = force && !doneThisRun.has(key);
    if ((!forced && age < TEAM_TTL) || failedRecently(key)) continue;
    tasks.push({
      key,
      label: `équipe ${team.page} (${team.game})`,
      priority: current ? 2 : 0,
      staleness: age,
      run: async (s) => {
        const page = await parsePage(team.game, team.page, onWait);
        const parsed = parseTeamPage(page.html, team);
        s.teams[team.id] = { id: team.id, name: team.page, ...parsed, fetchedAt: new Date().toISOString() };
        return `${parsed.upcoming.length} à venir, ${parsed.recent.length} récents`;
      },
    });
  }

  for (const [key, ref] of discover(snap)) {
    const current = snap.tournaments[key];
    const state = current ? tournamentState(current, snap) : undefined;
    const forced = force && !doneThisRun.has(key);
    if ((!forced && state === "done") || failedRecently(key)) continue;
    const ttl = state === "live" ? LIVE_TTL : ACTIVE_TTL;
    const age = ageOf(current?.fetchedAt);
    if (!forced && current && age < ttl) continue;
    tasks.push({
      key,
      label: `compétition ${ref.page} (${ref.wiki})${state === "live" ? " · en direct" : ""}`,
      priority: !current ? 1 : state === "live" ? 1.5 : 3,
      staleness: age,
      run: async (s) => {
        const page = await parsePage(ref.wiki, ref.page, onWait);
        const parsed = parseTournamentPage(page.html, ref.wiki, ref.page);
        const t: Tournament = { key, wiki: ref.wiki, page: ref.page, ...parsed, fetchedAt: new Date().toISOString() };
        s.tournaments[key] = t;
        return `${parsed.stages.length} phases, ${tournamentMatches(t).length} matchs`;
      },
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority || b.staleness - a.staleness);
}

/** Oublie les compétitions qui ne concernent plus aucune équipe suivie. */
function prune(snap: Snapshot) {
  if (!FOLLOWED.every((t) => snap.teams[t.id])) return;
  const keep = discover(snap);
  for (const key of Object.keys(snap.tournaments)) if (!keep.has(key)) delete snap.tournaments[key];
}

async function main() {
  log(watch ? "Synchronisation continue démarrée." : ci ? "Synchronisation planifiée : une passe bornée." : "Synchronisation : une passe.");
  for (let pages = 0; ; ) {
    const snap = readSnapshot();
    const [task, ...rest] = plan(snap);
    if (task && pages >= MAX_PAGES) {
      log(`Limite de ${MAX_PAGES} pages atteinte ; ${rest.length + 1} restent pour la prochaine passe.`);
      return;
    }
    if (!task) {
      if (!watch) {
        log("Tout est à jour.");
        return;
      }
      await sleep(IDLE_POLL);
      continue;
    }

    log(`↻ ${task.label}…`);
    doneThisRun.add(task.key);
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
        writeSnapshot(snap);
        if (!watch) throw e;
        log("Liquipedia refuse les requêtes : pause de 30 minutes.");
        await sleep(30 * MIN);
        continue;
      }
    }
    prune(snap);
    snap.updatedAt = new Date().toISOString();
    writeSnapshot(snap);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
