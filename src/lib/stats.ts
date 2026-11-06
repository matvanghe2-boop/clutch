/**
 * Statistiques d'une équipe, calculées à partir de ses résultats (du plus
 * récent au plus ancien) : bilans, records, adversaires, courbe de forme, et
 * bilan par carte. Rien ici ne lit Liquipedia ni l'instantané.
 */
import type { PastMatch } from "./derive";
import { norm } from "./derive";
import type { MapSample, TeamRef } from "./types";

export interface Tally {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Part de victoires, de 0 à 1. */
  rate: number;
}

type Outcome = Pick<PastMatch, "result">;

export function tally(list: Outcome[]): Tally {
  const wins = list.filter((m) => m.result === "win").length;
  const losses = list.filter((m) => m.result === "loss").length;
  return { played: list.length, wins, losses, draws: list.length - wins - losses, rate: list.length ? wins / list.length : 0 };
}

const DAY = 86400;

/** Bilans sur 30 jours, 3 mois, 12 mois et depuis le premier match connu. */
export function byPeriod(results: PastMatch[], now: number): { label: string; tally: Tally }[] {
  const within = (days: number) => tally(results.filter((r) => now - r.timestamp <= days * DAY));
  return [
    { label: "30 jours", tally: within(30) },
    { label: "3 mois", tally: within(91) },
    { label: "12 mois", tally: within(365) },
    { label: "Tout", tally: tally(results) },
  ];
}

/** Bilan par niveau de compétition, du plus haut au plus bas. */
export function byTier(results: PastMatch[]): { tier: string; tally: Tally }[] {
  const order = ["S-Tier", "A-Tier", "B-Tier", "C-Tier", "D-Tier", "Qualifier"];
  const tiers = order.filter((t) => results.some((r) => r.tier === t));
  return tiers.map((tier) => ({ tier, tally: tally(results.filter((r) => r.tier === tier)) }));
}

/** Scores d'une série (Bo3, Bo5…) : un Bo1 de CS2 donne le score de la carte (« 13-4 »), à écarter. */
function series(r: PastMatch): { win: number; lose: number } | undefined {
  const [a, b] = [Number(r.usScore), Number(r.themScore)];
  if (!r.usScore || !r.themScore || !Number.isInteger(a) || !Number.isInteger(b) || a === b) return undefined;
  const win = Math.max(a, b);
  const lose = Math.min(a, b);
  return win >= 2 && win <= 5 ? { win, lose } : undefined;
}

export interface Streak {
  count: number;
  from: number;
  to: number;
}

function longest(chrono: PastMatch[], result: PastMatch["result"]): Streak | undefined {
  let best: Streak | undefined;
  let current: Streak | undefined;
  for (const m of chrono) {
    if (m.result === result) {
      current = current ? { ...current, count: current.count + 1, to: m.timestamp } : { count: 1, from: m.timestamp, to: m.timestamp };
      if (!best || current.count > best.count) best = current;
    } else current = undefined;
  }
  return best;
}

export interface TeamRecords {
  bestStreak?: Streak;
  worstStreak?: Streak;
  /** Séries (Bo3 et plus) jouées, gagnées sans perdre de manche, et allées à la manche décisive. */
  seriesPlayed: number;
  sweeps: number;
  sweptBy: number;
  deciders: number;
  decidersWon: number;
}

export function recordsOf(results: PastMatch[]): TeamRecords {
  const chrono = [...results].sort((a, b) => a.timestamp - b.timestamp);
  const games = results.flatMap((r) => {
    const s = series(r);
    return s ? [{ ...s, won: r.result === "win" }] : [];
  });
  const close = games.filter((g) => g.win - g.lose === 1);
  return {
    bestStreak: longest(chrono, "win"),
    worstStreak: longest(chrono, "loss"),
    seriesPlayed: games.length,
    sweeps: games.filter((g) => g.won && g.lose === 0).length,
    sweptBy: games.filter((g) => !g.won && g.lose === 0).length,
    deciders: close.length,
    decidersWon: close.filter((g) => g.won).length,
  };
}

export interface Rival {
  opponent: TeamRef;
  tally: Tally;
}

/**
 * Bêtes noires et victimes préférées, à partir de `min` matchs. Une bête noire a
 * un bilan défavorable, une victime un bilan favorable ; à égalité de taux, le
 * plus grand nombre de rencontres passe devant.
 */
export function rivals(results: PastMatch[], min = 3, max = 5): { victims: Rival[]; nemeses: Rival[] } {
  const groups = new Map<string, { opponent: TeamRef; list: PastMatch[] }>();
  for (const r of results) {
    if (!r.opponent) continue;
    const key = norm(r.opponent.page ?? r.opponent.name);
    const g = groups.get(key) ?? { opponent: r.opponent, list: [] };
    g.list.push(r);
    groups.set(key, g);
  }
  const all = [...groups.values()].filter((g) => g.list.length >= min).map((g) => ({ opponent: g.opponent, tally: tally(g.list) }));
  return {
    victims: all
      .filter((a) => a.tally.rate > 0.5)
      .sort((a, b) => b.tally.rate - a.tally.rate || b.tally.played - a.tally.played)
      .slice(0, max),
    nemeses: all
      .filter((a) => a.tally.rate < 0.5)
      .sort((a, b) => a.tally.rate - b.tally.rate || b.tally.played - a.tally.played)
      .slice(0, max),
  };
}

export interface CurvePoint {
  timestamp: number;
  /** Part de victoires sur les `size` derniers matchs à cette date, de 0 à 1. */
  rate: number;
}

/** Taux de victoire glissant, dans l'ordre chronologique. Vide tant qu'il n'y a pas assez de matchs. */
export function formCurve(results: PastMatch[], size = 10): CurvePoint[] {
  const chrono = [...results].sort((a, b) => a.timestamp - b.timestamp);
  const out: CurvePoint[] = [];
  for (let i = size - 1; i < chrono.length; i++) {
    const window = chrono.slice(i - size + 1, i + 1);
    out.push({ timestamp: chrono[i].timestamp, rate: window.filter((m) => m.result === "win").length / size });
  }
  return out;
}

export interface MapTally {
  /** Carte (CS2, CoD) ou arène (Rocket League). */
  map: string;
  played: number;
  wins: number;
  rate: number;
  /** Rounds ou buts marqués et encaissés, en moyenne par manche. */
  forAvg: number;
  againstAvg: number;
}

/** « Mannfield (Dusk) - OT (+1:25) » : une prolongation ne fait pas une autre arène. */
const arenaOf = (map: string) => map.replace(/\s*-\s*OT\b.*$/i, "").trim();

/** Bilan par carte, de la plus jouée à la moins jouée. */
export function byMap(samples: MapSample[]): MapTally[] {
  const groups = new Map<string, MapSample[]>();
  for (const s of samples) {
    if (!s.map) continue;
    const key = arenaOf(s.map);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([map, list]) => {
      const wins = list.filter((s) => s.won).length;
      return {
        map,
        played: list.length,
        wins,
        rate: wins / list.length,
        forAvg: list.reduce((n, s) => n + s.us, 0) / list.length,
        againstAvg: list.reduce((n, s) => n + s.them, 0) / list.length,
      };
    })
    .sort((a, b) => b.played - a.played || b.rate - a.rate);
}

/** Bilan toutes cartes confondues : manches gagnées et, en moyenne, rounds ou buts par manche. */
export function gamesSummary(samples: MapSample[]) {
  if (!samples.length) return undefined;
  const wins = samples.filter((s) => s.won).length;
  return {
    played: samples.length,
    wins,
    rate: wins / samples.length,
    forAvg: samples.reduce((n, s) => n + s.us, 0) / samples.length,
    againstAvg: samples.reduce((n, s) => n + s.them, 0) / samples.length,
  };
}
