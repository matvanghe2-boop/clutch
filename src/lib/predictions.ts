/**
 * Pronostics : un score donné avant le match, comparé au résultat ensuite.
 * Score exact : 3 points ; bon vainqueur (ou bon nul) : 1 point.
 *
 * Chaque pronostic garde de quoi retrouver le résultat même si l'identifiant
 * du match change entre-temps (Liquipedia corrige un horaire, la page d'équipe
 * retire le match) : équipe, adversaire et heure, à 3 h près.
 */
import type { GameId } from "./types";

export interface Prediction {
  /** Score pronostiqué, côté équipe suivie puis adversaire. */
  us: number;
  them: number;
  /** Quand il a été donné. */
  at: string;
  wiki: GameId;
  teamId: string;
  opponent: { name: string; page?: string };
  /** Début annoncé du match (secondes). */
  timestamp?: number;
  tournament?: string;
  bestOf?: number;
}

export type Predictions = Record<string, Prediction>;

export interface Verdict {
  points: 0 | 1 | 3;
  exact: boolean;
  winner: boolean;
}

const sign = (a: number, b: number) => Math.sign(a - b);

export function judge(p: Pick<Prediction, "us" | "them">, actual: { us: number; them: number }): Verdict {
  const exact = p.us === actual.us && p.them === actual.them;
  const winner = sign(p.us, p.them) === sign(actual.us, actual.them);
  return { points: exact ? 3 : winner ? 1 : 0, exact, winner };
}

/**
 * Scores possibles pour un format « au meilleur de N » : Bo5 → 3-0, 3-1, 3-2,
 * 2-3, 1-3, 0-3. Un format pair autorise le nul (Bo2 : 2-0, 1-1, 0-2).
 * Sans format connu : null, la saisie reste libre.
 */
export function possibleScores(bestOf?: number): [number, number][] | null {
  if (!bestOf || bestOf < 1 || bestOf > 9) return null;
  const need = Math.floor(bestOf / 2) + 1;
  const wins: [number, number][] = [];
  for (let lost = 0; lost < need && need + lost <= bestOf; lost++) wins.push([need, lost]);
  const draw: [number, number][] = bestOf % 2 === 0 ? [[bestOf / 2, bestOf / 2]] : [];
  return [...wins, ...draw, ...wins.map(([a, b]) => [b, a] as [number, number]).reverse()];
}

export function validScore(us: number, them: number, bestOf?: number): boolean {
  if (![us, them].every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) return false;
  const allowed = possibleScores(bestOf);
  return !allowed || allowed.some(([a, b]) => a === us && b === them);
}

const plain = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ce qui situe un pronostic : l'équipe, l'adversaire et l'heure du match. */
export type PickProbe = Pick<Prediction, "wiki" | "teamId" | "opponent" | "timestamp">;

/**
 * Deux pronostics sur le même match : même équipe, même adversaire connu, à moins de 3 h.
 * Le même match a parfois deux identifiants (page de l'équipe et page de la compétition, qui ne
 * rangent pas les équipes dans le même ordre ; horaire publié ou déplacé entre-temps) : sans ce
 * rapprochement, on pouvait le pronostiquer deux fois et il comptait double dans le bilan.
 */
export function samePick(a: PickProbe, b: PickProbe): boolean {
  if (a.wiki !== b.wiki || a.teamId !== b.teamId) return false;
  const them = plain(a.opponent.page ?? a.opponent.name);
  if (!them || them === "a determiner" || them !== plain(b.opponent.page ?? b.opponent.name)) return false;
  return a.timestamp !== undefined && b.timestamp !== undefined && Math.abs(a.timestamp - b.timestamp) < 3 * 3600;
}

/** Un seul pronostic par match : le dernier donné. */
export function dedupePredictions(all: Predictions): Predictions {
  const newest = Object.entries(all).sort(([, a], [, b]) => Date.parse(b.at) - Date.parse(a.at));
  const kept: [string, Prediction][] = [];
  for (const [id, p] of newest) if (!kept.some(([, q]) => samePick(p, q))) kept.push([id, p]);
  return Object.fromEntries(kept);
}

/** Le pronostic déjà donné pour ce match, quel que soit l'identifiant sous lequel il a été rangé. */
export function findPick(all: Predictions, probe: PickProbe, ids: string[] = []): Prediction | undefined {
  for (const id of ids) if (all[id]) return all[id];
  return Object.values(all).find((p) => samePick(p, probe));
}
