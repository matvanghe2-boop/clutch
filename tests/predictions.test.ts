import { describe, expect, it } from "vitest";
import { formOf } from "@/lib/derive";
import { dedupePredictions, findPick, judge, possibleScores, samePick, validScore } from "@/lib/predictions";

describe("scores possibles selon le format", () => {
  it.each([
    [3, [[2, 0], [2, 1], [1, 2], [0, 2]]],
    [5, [[3, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 3]]],
    [7, [[4, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 4]]],
    [1, [[1, 0], [0, 1]]],
    [2, [[2, 0], [1, 1], [0, 2]]],
  ])("Bo%i", (bo, expected) => {
    expect(possibleScores(bo)).toEqual(expected);
  });

  it("sans format connu, la saisie reste libre", () => {
    expect(possibleScores(undefined)).toBeNull();
    expect(validScore(13, 11)).toBe(true);
  });

  it("refuse un score impossible dans le format", () => {
    expect(validScore(3, 1, 5)).toBe(true);
    expect(validScore(4, 1, 5)).toBe(false);
    expect(validScore(2, 2, 5)).toBe(false);
    expect(validScore(-1, 3)).toBe(false);
    expect(validScore(1.5, 3)).toBe(false);
  });
});

describe("points d'un pronostic", () => {
  it("score exact : 3 points", () => {
    expect(judge({ us: 3, them: 1 }, { us: 3, them: 1 })).toEqual({ points: 3, exact: true, winner: true });
  });
  it("bon vainqueur : 1 point", () => {
    expect(judge({ us: 3, them: 2 }, { us: 3, them: 0 })).toEqual({ points: 1, exact: false, winner: true });
  });
  it("mauvais vainqueur : 0", () => {
    expect(judge({ us: 3, them: 2 }, { us: 1, them: 3 })).toEqual({ points: 0, exact: false, winner: false });
  });
  it("un nul bien vu compte comme le bon vainqueur", () => {
    expect(judge({ us: 1, them: 1 }, { us: 1, them: 1 }).points).toBe(3);
    expect(judge({ us: 2, them: 2 }, { us: 1, them: 1 }).points).toBe(1);
  });
});

describe("forme du moment", () => {
  const r = (...xs: ("win" | "loss" | "draw")[]) => xs.map((result) => ({ result }));

  it("compte victoires et défaites sur les dix derniers, et la série en cours", () => {
    const form = formOf(r("win", "win", "win", "loss", "win", "loss", "win", "win", "win", "win", "loss", "loss"));
    expect(form.last).toHaveLength(10);
    expect(form).toMatchObject({ wins: 8, losses: 2, draws: 0, streak: { result: "win", count: 3 } });
  });

  it("sans résultat, pas de série", () => {
    expect(formOf([])).toMatchObject({ last: [], streak: undefined });
  });
});

describe("un seul pronostic par match", () => {
  const base = { us: 3, them: 1, wiki: "callofduty" as const, teamId: "m8-cdl", opponent: { name: "Toronto KOI", page: "Toronto KOI" }, timestamp: 1794168000 };

  it("rapproche le même match vu sous deux identifiants, et garde le dernier pronostic", () => {
    const all = {
      "callofduty:1794168000:paris-gentle-mates~toronto-koi": { ...base, at: "2026-11-08T10:00:00Z" },
      "callofduty:1794168000:toronto-koi~paris-gentle-mates": { ...base, us: 3, them: 2, at: "2026-11-08T12:00:00Z" },
    };
    const kept = dedupePredictions(all);
    expect(Object.keys(kept)).toEqual(["callofduty:1794168000:toronto-koi~paris-gentle-mates"]);
    expect(findPick(all, { ...base, timestamp: base.timestamp + 3600 })?.them).toBeDefined();
  });

  it("garde deux matchs distincts contre le même adversaire (finale du haut, puis grande finale)", () => {
    const all = {
      a: { ...base, at: "2026-11-08T10:00:00Z" },
      b: { ...base, timestamp: base.timestamp + 4 * 3600, at: "2026-11-08T12:00:00Z" },
      c: { ...base, teamId: "vitality-cs2", wiki: "counterstrike" as const, at: "2026-11-08T12:00:00Z" },
    };
    expect(Object.keys(dedupePredictions(all)).sort()).toEqual(["a", "b", "c"]);
  });

  it("ne rapproche pas deux adversaires encore inconnus", () => {
    const tbd = { ...base, opponent: { name: "À déterminer" } };
    expect(samePick(tbd, { ...tbd })).toBe(false);
  });
});
