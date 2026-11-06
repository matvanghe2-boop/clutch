import { describe, expect, it } from "vitest";
import { toFollowed } from "@/config/follow";
import type { PastMatch } from "@/lib/derive";
import { byMap, byPeriod, byTier, formCurve, gamesSummary, recordsOf, rivals, tally } from "@/lib/stats";
import { isDue } from "@/lib/sync/engine";
import type { MapSample } from "@/lib/types";

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
