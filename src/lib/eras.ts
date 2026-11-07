/**
 * Les périodes d'effectif d'une équipe : chaque changement de joueur en ouvre une.
 *
 * Un club peut changer entièrement d'équipe du jour au lendemain : les trois joueurs
 * de Gentle Mates sont arrivés le 28 octobre 2026, après le départ de tous les autres.
 * Ses statistiques n'ont de sens que découpées ainsi.
 */
import type { PastMatch } from "./derive";
import type { Palmares, RosterEntry, RosterStint } from "./types";

/** Les rôles qui ne jouent pas (ou plus) les matchs. Capitaine et IGL restent des joueurs. */
const NOT_PLAYING = /coach|analyst|manager|substitute|\bsub\b|rfa|inactive|bench|loan|stand|staff|director|content|owner|ceo/i;
export const isPlayer = (role?: string) => !role || !NOT_PLAYING.test(role);

const dayOf = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

export interface Era {
  /** Début de la période, AAAA-MM-JJ : c'est aussi son identifiant. */
  from: string;
  /** Fin, exclue. Absente pour l'effectif actuel. */
  to?: string;
  players: string[];
  current: boolean;
  /** Ses matchs, du plus récent au plus ancien. */
  results: PastMatch[];
}

interface Span {
  id: string;
  from: string;
  to?: string;
}

/**
 * Découpe l'histoire du club en périodes, de la plus récente à la plus ancienne.
 * Une période sans match (quelques jours entre deux joueurs) disparaît, sauf
 * l'effectif actuel, qui n'a peut-être encore rien joué.
 */
export function rosterEras(roster: RosterEntry[], stints: RosterStint[], results: PastMatch[]): Era[] {
  const spans: Span[] = [
    ...roster.filter((p) => p.joined && isPlayer(p.role)).map((p) => ({ id: p.id, from: p.joined! })),
    ...stints.filter((s) => isPlayer(s.role)).map((s) => ({ id: s.id, from: s.joined, to: s.left })),
  ];
  if (!spans.length) return [];

  const cuts = [...new Set(spans.flatMap((s) => (s.to ? [s.from, s.to] : [s.from])))].sort();
  const eras: Omit<Era, "results" | "current">[] = [];
  cuts.forEach((from, i) => {
    const players = [...new Set(spans.filter((s) => s.from <= from && (!s.to || s.to > from)).map((s) => s.id))].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    const last = eras.at(-1);
    // Même équipe avant et après (un joueur remplacé par lui-même, une ligne en double) : une seule période.
    if (last && last.players.join() === players.join()) last.to = cuts[i + 1];
    else eras.push({ from, to: cuts[i + 1], players });
  });

  const all = eras.map((era, i) => {
    const inEra = results.filter((r) => {
      const day = dayOf(r.timestamp);
      return day >= era.from && (!era.to || day < era.to);
    });
    return { ...era, current: i === eras.length - 1 && era.players.length > 0, results: inEra };
  });
  return all.filter((e) => e.current || (e.results.length > 0 && e.players.length > 0)).reverse();
}

/** L'effectif affiché : celui demandé dans l'adresse, l'actuel par défaut ; rien pour tout l'historique. */
export function pickEra(eras: Era[], wanted: string | undefined): Era | undefined {
  if (wanted === "tout") return undefined;
  return eras.find((e) => e.from === wanted) ?? eras.find((e) => e.current);
}

/** Depuis quand l'effectif en place joue ensemble : la dernière arrivée d'un joueur. */
export function lineupSince(roster: RosterEntry[]): string | undefined {
  return roster
    .filter((p) => p.joined && isPlayer(p.role))
    .map((p) => p.joined!)
    .sort()
    .at(-1);
}

/** Combien des résultats (du plus récent au plus ancien) datent de cet effectif. */
export const playedSince = (results: { timestamp: number }[], since: string | undefined) => (since ? results.filter((r) => dayOf(r.timestamp) >= since).length : 0);

/**
 * Titres remportés pendant une période. Le palmarès ne garde que les compétitions
 * récentes : pour une période plus ancienne qu'elles, on ne sait pas.
 */
export function titlesIn(era: Era, palmares: Palmares | undefined): number | undefined {
  if (!palmares?.rows.length) return undefined;
  const oldest = palmares.rows.at(-1)!.date;
  const complete = palmares.events <= palmares.rows.length || (oldest !== undefined && oldest <= era.from);
  if (!complete) return undefined;
  return palmares.rows.filter((r) => r.rank === 1 && r.date && r.date >= era.from && (!era.to || r.date < era.to)).length;
}
