import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toFollowed } from "@/config/follow";
import type { PastMatch } from "@/lib/derive";
import { money, monthYearOf, placeFr, tenure } from "@/lib/format";
import { byMap, byPeriod, byTier, formCurve, gamesSummary, recordsOf, rivals, tally } from "@/lib/stats";
import { isDue, tournamentState } from "@/lib/sync/engine";
import type { MapSample, Match, Snapshot, Tournament } from "@/lib/types";

const team = toFollowed({ id: "x", game: "counterstrike", page: "X" });
const NOW = Date.parse("2026-11-06T12:00:00Z") / 1000;
const DAY = 86400;

const past = (daysAgo: number, us: string, them: string, opponent = "A", tier = "S-Tier"): PastMatch => ({
  team,
  timestamp: NOW - daysAgo * DAY,
  opponent: { name: opponent, page: opponent },
  usScore: us,
  themScore: them,
  result: Number(us) > Number(them) ? "win" : Number(us) < Number(them) ? "loss" : "draw",
  tournament: { name: "T" },
  tier,
});

describe("bilans", () => {
  const results = [past(5, "2", "0"), past(20, "1", "2"), past(60, "2", "1", "B", "A-Tier"), past(200, "2", "0"), past(500, "0", "2")];

  it("par période", () => {
    const [d30, m3, m12, all] = byPeriod(results, NOW);
    expect([d30.tally.played, d30.tally.wins]).toEqual([2, 1]);
    expect([m3.tally.played, m3.tally.wins]).toEqual([3, 2]);
    expect([m12.tally.played, m12.tally.wins]).toEqual([4, 3]);
    expect(all.tally).toMatchObject({ played: 5, wins: 3, losses: 2, rate: 0.6 });
  });

  it("par niveau, du plus haut au plus bas", () => {
    expect(byTier(results).map((t) => [t.tier, t.tally.played])).toEqual([
      ["S-Tier", 4],
      ["A-Tier", 1],
    ]);
  });

  it("sans match, un taux nul plutôt qu'une division par zéro", () => {
    expect(tally([]).rate).toBe(0);
  });
});

describe("records", () => {
  it("trouve les séries les plus longues, dans l'ordre chronologique", () => {
    const r = recordsOf([past(1, "2", "0"), past(2, "2", "1"), past(3, "2", "0"), past(4, "0", "2"), past(5, "1", "2"), past(6, "2", "0")]);
    expect(r.bestStreak?.count).toBe(3);
    expect(r.bestStreak?.to).toBe(NOW - DAY);
    expect(r.worstStreak?.count).toBe(2);
  });

  it("compte balayages et manches décisives, sans les Bo1 de CS2 (score de carte)", () => {
    const r = recordsOf([past(1, "2", "0"), past(2, "3", "2"), past(3, "1", "2"), past(4, "0", "3"), past(5, "13", "4"), past(6, "1", "0")]);
    expect(r.seriesPlayed).toBe(4);
    expect(r.sweeps).toBe(1);
    expect(r.sweptBy).toBe(1);
    expect(r.deciders).toBe(2);
    expect(r.decidersWon).toBe(1);
  });
});

describe("adversaires", () => {
  it("ne retient que ceux rencontrés assez souvent, et sépare victimes et bêtes noires", () => {
    const results = [
      ...["V", "V", "V"].map((n, i) => past(i, "2", "0", n)),
      ...["N", "N", "N"].map((n, i) => past(i + 10, "0", "2", n)),
      past(20, "2", "0", "Rare"),
      past(21, "2", "0", "Rare"),
    ];
    const { victims, nemeses } = rivals(results);
    expect(victims.map((v) => v.opponent.name)).toEqual(["V"]);
    expect(nemeses.map((n) => n.opponent.name)).toEqual(["N"]);
    expect(nemeses[0].tally).toMatchObject({ played: 3, wins: 0 });
  });
});

describe("courbe de forme", () => {
  it("donne le taux glissant dans l'ordre chronologique", () => {
    const results = [past(1, "2", "0"), past(2, "2", "0"), past(3, "0", "2"), past(4, "0", "2")];
    expect(formCurve(results, 2).map((p) => p.rate)).toEqual([0, 0.5, 1]);
    expect(formCurve(results, 10)).toEqual([]);
  });
});

describe("cartes", () => {
  const s = (map: string, us: number, them: number): MapSample => ({ map, us, them, won: us > them, at: NOW });

  it("bilan par carte, de la plus jouée à la moins jouée", () => {
    const maps = byMap([s("Mirage", 13, 10), s("Mirage", 8, 13), s("Nuke", 13, 5)]);
    expect(maps.map((m) => m.map)).toEqual(["Mirage", "Nuke"]);
    expect(maps[0]).toMatchObject({ played: 2, wins: 1, rate: 0.5, forAvg: 10.5, againstAvg: 11.5 });
  });

  it("une prolongation reste la même arène", () => {
    const maps = byMap([s("Mannfield (Dusk)", 3, 1), s("Mannfield (Dusk) - OT (+1:25)", 2, 1)]);
    expect(maps.map((m) => [m.map, m.played])).toEqual([["Mannfield (Dusk)", 2]]);
  });

  it("résumé toutes cartes confondues", () => {
    expect(gamesSummary([s("A", 4, 1), s("B", 1, 3)])).toMatchObject({ played: 2, wins: 1, forAvg: 2.5, againstAvg: 2 });
    expect(gamesSummary([])).toBeUndefined();
  });
});

describe("calendrier de la synchro", () => {
  const SLOT = 5 * 60_000;
  const MIN = 60_000;
  const start = Date.parse("2026-11-06T00:00:00Z");
  const dueOver = (key: string, ttl: number, slots: number) =>
    Array.from({ length: slots }, (_, i) => isDue("cron", key, ttl * 10, ttl, start + i * SLOT)).filter(Boolean).length;

  it("une page jamais lue est toujours à lire", () => {
    expect(isDue("cron", "k", Infinity, 30 * MIN, start)).toBe(true);
    expect(isDue("local", "k", Infinity, 30 * MIN, start)).toBe(true);
  });

  it("hors cron, seul l'âge compte", () => {
    expect(isDue("local", "k", 29 * MIN, 30 * MIN)).toBe(false);
    expect(isDue("ci", "k", 31 * MIN, 30 * MIN)).toBe(true);
  });

  it("le cron relit une page une fois par période, même si son âge paraît ancien", () => {
    expect(dueOver("team:m8-rl", 30 * MIN, 288)).toBe(48);
    expect(dueOver("portal:cs", 6 * 60 * MIN, 288)).toBe(4);
    expect(dueOver("ranking:cs", 24 * 60 * MIN, 288)).toBe(1);
  });

  it("le direct est relu à chaque passe", () => {
    expect(dueOver("team:m8-rl", 4 * MIN, 12)).toBe(12);
  });

  it("les pages ne tombent pas toutes sur le même créneau", () => {
    const keys = ["team:m8-rl", "team:vitality-cs2", "team:m8-cdl", "portal:rocketleague", "ranking:counterstrike", "opponent:rocketleague:Karmine Corp"];
    const slots = keys.map((k) => Array.from({ length: 288 }, (_, i) => i).find((i) => isDue("cron", k, 1e12, 24 * 60 * MIN, start + i * SLOT)));
    expect(new Set(slots).size).toBeGreaterThan(3);
  });
});

describe("formats", () => {
  const now = Date.parse("2026-11-06T12:00:00Z") / 1000;

  it("ancienneté", () => {
    expect(tenure("2024-01-04", undefined, now)).toBe("2 ans 10 mois");
    expect(tenure("2026-10-28", undefined, now)).toBe("1 sem.");
    expect(tenure("2025-10-11", "2026-10-26", now)).toBe("1 an");
    expect(tenure("2026-11-05", undefined, now)).toBe("2 j");
    expect(tenure(undefined, undefined, now)).toBeUndefined();
    expect(tenure("2026-12-01", undefined, now)).toBeUndefined();
  });

  it("places à la française", () => {
    expect(placeFr("1st")).toBe("1er");
    expect(placeFr("3rd - 4th")).toBe("3e–4e");
    expect(placeFr("17th - 32nd")).toBe("17e–32e");
    expect(placeFr("W")).toBe("V");
  });

  it("montants à la française, et le reste tel quel", () => {
    expect(money("$646,200")).toBe("646\u202f200\u00a0$");
    expect(money("€5,000")).toBe("€5,000");
    expect(money(undefined)).toBeUndefined();
  });

  it("mois et année", () => {
    expect(monthYearOf("2024-01-04")).toBe("janvier 2024");
    expect(monthYearOf("?")).toBeUndefined();
  });
});

describe("rythme de lecture d'une compétition", () => {
  const cdl = toFollowed({ id: "m8-cdl", game: "callofduty", page: "Paris Gentle Mates" });
  const paris = { name: "Paris Gentle Mates", page: "Paris Gentle Mates" };
  const other = { name: "G2 Minnesota", page: "G2 Minnesota" };
  const now = Date.parse("2026-11-07T05:00:00Z");
  const match = (over: Partial<Match>): Match => ({ id: "x", wiki: "callofduty", streams: [], games: [], finished: false, opponents: [paris, other], scores: [null, null], ...over });
  const tournament = (matches: Match[], over: Partial<Tournament> = {}): Tournament =>
    ({
      key: "k",
      wiki: "callofduty",
      page: "P",
      name: "P",
      info: {},
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      stages: [{ title: "Playoffs", anchor: "Playoffs", blocks: [{ kind: "matchlist", list: { title: "T", matches } }] }],
      fetchedAt: "2026-11-07T04:00:00Z",
      ...over,
    }) as Tournament;
  const snap = { teams: {} } as unknown as Snapshot;
  const at = (hours: number) => now / 1000 + hours * 3600;
  const state = (t: Tournament) => tournamentState(t, snap, [cdl]);

  beforeEach(() => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("guette l'horaire tant que le match de mon équipe n'en a pas", () => {
    expect(state(tournament([match({})]))).toBe("scheduling");
    expect(state(tournament([match({ timestamp: at(20), timeTbd: true })]))).toBe("scheduling");
  });

  it("guette aussi un match d'ici 24 h, qui peut bouger, et le tour qui suit un match joué", () => {
    expect(state(tournament([match({ timestamp: at(15) })]))).toBe("scheduling");
    expect(state(tournament([match({ timestamp: at(-5), finished: true })]))).toBe("scheduling");
  });

  it("suit le direct dès qu'un match approche", () => {
    expect(state(tournament([match({ timestamp: at(2) })]))).toBe("live");
  });

  it("ne relit pas toutes les 10 min pour un match lointain, ou une compétition d'autres équipes", () => {
    expect(state(tournament([match({ timestamp: at(72) })], { endDate: "2026-11-30" }))).toBe("active");
    expect(state(tournament([match({ opponents: [other, { name: "Riyadh Falcons" }] })]))).toBe("active");
  });

  it("hors de ses dates, un match sans horaire ne fait plus guetter la compétition", () => {
    expect(state(tournament([match({})], { startDate: "2026-12-01", endDate: "2026-12-05" }))).toBe("active");
    expect(state(tournament([match({})], { startDate: "2026-10-01", endDate: "2026-10-05" }))).toBe("active");
  });

  it("le créneau du cron relit alors la page toutes les 10 min", () => {
    const start = Date.parse("2026-11-07T00:00:00Z");
    const slots = Array.from({ length: 12 }, (_, i) => isDue("cron", "callofduty:P", 1e12, 10 * 60_000, start + i * 5 * 60_000)).filter(Boolean);
    expect(slots.length).toBe(6);
  });
});
