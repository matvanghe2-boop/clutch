import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bracketLayout } from "@/lib/bracket";
import { parseTournamentPage } from "@/lib/liquipedia/tournament-page";
import { tournamentMatches } from "@/lib/tournament";
import type { Bracket, BracketNode, Match, Stage } from "@/lib/types";
import { atCaptureDate, fixture } from "./fixtures";

beforeAll(atCaptureDate);
afterAll(() => vi.useRealTimers());

const blocks = <K extends Stage["blocks"][number]["kind"]>(stage: Stage | undefined, kind: K) =>
  (stage?.blocks ?? []).filter((b): b is Extract<Stage["blocks"][number], { kind: K }> => b.kind === kind);

function matchesOf(node: BracketNode): Match[] {
  return [...(node.match ? [node.match] : []), ...node.children.flatMap(matchesOf)];
}
const bracketMatches = (b: Bracket) => b.sections.flatMap((s) => s.roots.flatMap(matchesOf));

describe("Coupe de France Slash 2026 (Rocket League)", () => {
  const t = parseTournamentPage(fixture("tournament-rl-coupe-de-france.html"), "rocketleague", "NEO/Coupe de France Slash/2026");
  const [league, playoffs] = t.stages;

  it("lit le nom, les dates et les participants", () => {
    expect(t.name).toBe("Coupe de France Slash 2026");
    expect([t.startDate, t.endDate]).toEqual(["2026-11-02", "2026-11-12"]);
    expect(t.participants).toHaveLength(6);
    expect(t.participants.map((p) => p.name)).toContain("Gentle Mates");
  });

  it("range le classement et une liste de matchs par journée sous « League Play »", () => {
    expect(league.title).toBe("League Play");
    const [table] = blocks(league, "group").map((b) => b.table);
    expect(table.rows.map((r) => r.rank)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(table.rows[0]).toMatchObject({ status: "up" });
    expect(table.rows[0].team?.name).toBe("Gentle Mates");
    const lists = blocks(league, "matchlist").map((b) => b.list);
    expect(lists.map((l) => l.title)).toEqual(["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"]);
    for (const l of lists) {
      expect(l.matches).toHaveLength(5);
      for (const m of l.matches) expect(m.round).toBe(l.title);
    }
  });

  it("lit les scores des matchs joués et laisse les autres à venir", () => {
    const day1 = blocks(league, "matchlist")[0].list.matches[0];
    expect(day1.opponents.map((o) => o?.name)).toEqual(["Gentle Mates", "Karmine Corp"]);
    expect(day1).toMatchObject({ finished: true, scores: ["3", "0"], winner: 1 });
    expect(day1.games.length).toBeGreaterThan(0);
    const day4 = blocks(league, "matchlist")[3].list.matches[0];
    expect(day4.finished).toBe(false);
  });

  it("nomme les tours du bracket des playoffs", () => {
    const [bracket] = blocks(playoffs, "bracket").map((b) => b.bracket);
    expect(bracket.sections).toHaveLength(1);
    expect(bracket.sections[0].headers).toEqual(["Semifinals", "Grand Final"]);
    const ms = bracketMatches(bracket);
    expect(ms).toHaveLength(3);
    expect(ms.map((m) => m.round)).toEqual(["Grand Final", "Semifinals", "Semifinals"]);
  });
});

describe("PGL Masters Bucharest 2026 (CS2)", () => {
  const t = parseTournamentPage(fixture("tournament-cs-pgl-masters.html"), "counterstrike", "PGL/2026/Masters");
  const [groups, playoffs] = t.stages;

  it("lit l'infobox et les seize participants", () => {
    expect(t.info["Liquipedia Tier"]).toBe("S-Tier");
    expect(t.participants).toHaveLength(16);
  });

  it("lit le classement du format suisse avec une case par ronde", () => {
    const [table] = blocks(groups, "group").map((b) => b.table);
    expect(table.rows).toHaveLength(16);
    const vitality = table.rows.find((r) => r.team?.name === "Team Vitality");
    expect(vitality?.rounds?.length).toBeGreaterThanOrEqual(4);
    for (const r of vitality?.rounds ?? []) expect(["win", "loss", "draw", undefined]).toContain(r.result);
  });

  it("garde les intitulés des listes de rondes", () => {
    const titles = blocks(groups, "matchlist").map((b) => b.list.title);
    expect(titles[0]).toBe("Round 1 Matches");
    expect(titles).toContain("Round 5 Matches");
  });

  it("lit les cartes de chaque match joué, avec leur score et leur vainqueur", () => {
    const pool = ["Ancient", "Anubis", "Cache", "Dust II", "Inferno", "Mirage", "Nuke"];
    const played = blocks(groups, "matchlist").flatMap((b) => b.list.matches).filter((m) => m.finished);
    expect(played.length).toBeGreaterThan(20);
    for (const m of played) {
      expect(m.games.length).toBeGreaterThan(0);
      for (const g of m.games) {
        expect(pool).toContain(g.map);
        const [a, b] = [Number(g.score1), Number(g.score2)];
        expect(g.winner).toBe(a > b ? 1 : 2);
      }
    }
  });

  it("nomme quarts, demies et finale", () => {
    const [bracket] = blocks(playoffs, "bracket").map((b) => b.bracket);
    const ms = bracketMatches(bracket);
    expect(ms).toHaveLength(7);
    expect(new Set(ms.map((m) => m.round))).toEqual(new Set(["Quarterfinals", "Semifinals", "Grand Final"]));
  });
});

describe("Monster Launch Invitational (CDL, double élimination)", () => {
  const t = parseTournamentPage(fixture("tournament-cod-monster-launch.html"), "callofduty", "Call of Duty League/Season 8/Monster Launch Invitational");
  const [groups, playoffs] = t.stages;

  it("lit les quatre groupes, chacun en bracket gagnant et perdant avec une colonne « Qualified »", () => {
    const brackets = blocks(groups, "bracket").map((b) => b.bracket);
    expect(brackets).toHaveLength(4);
    for (const b of brackets) {
      expect(b.sections.map((s) => s.headers.at(-1))).toEqual(["Qualified", "Qualified"]);
      expect(bracketLayout(b.sections[0]).trailing).toBe("Qualified");
      for (const m of bracketMatches(b)) expect(m.round).toMatch(/Bracket (Semifinals|Final)$/);
    }
  });

  it("sépare le bracket perdant, niché dans l'arbre, en section propre", () => {
    const [bracket] = blocks(playoffs, "bracket").map((b) => b.bracket);
    const [upper, lower] = bracket.sections;
    expect(upper.headers).toEqual(["Upper Bracket Quarterfinals", "Upper Bracket Semifinals", "Upper Bracket Final", "Grand Final"]);
    expect(lower.headers[0]).toBe("Lower Bracket Round 1");
    expect(upper.roots.flatMap(matchesOf)).toHaveLength(8);
    expect(lower.roots.flatMap(matchesOf)).toHaveLength(6);
  });

  it("nomme chacun des quatorze matchs, finale du bracket gagnant décalée d'une colonne", () => {
    const [bracket] = blocks(playoffs, "bracket").map((b) => b.bracket);
    const [upper, lower] = bracket.sections;
    const ms = bracketMatches(bracket);
    expect(ms.every((m) => m.round)).toBe(true);
    expect(upper.roots[0].match?.round).toBe("Grand Final");
    expect(upper.roots[0].children[0].skip).toBe(1);
    expect(upper.roots[0].children[0].match?.round).toBe("Upper Bracket Final");
    expect(lower.roots[0].match?.round).toBe("Lower Bracket Final");
    // La finale du bracket perdant se joue dans la colonne laissée vide en haut.
    expect(bracketLayout(upper).columns).toEqual([
      "Upper Bracket Quarterfinals",
      "Upper Bracket Semifinals",
      "Upper Bracket Final",
      null,
      "Grand Final",
    ]);
    expect(bracketLayout(lower).width).toBe(4);
  });
});

describe("horaires du bracket (Monster Launch, 2e jour)", () => {
  const t = parseTournamentPage(fixture("tournament-cod-monster-launch-day2.html"), "callofduty", "Call of Duty League/Season 8/Monster Launch Invitational");

  it("lit l'heure d'un match du bracket dès que Liquipedia la publie", () => {
    const match = tournamentMatches(t).find((m) => m.opponents[0]?.name === "Paris Gentle Mates" && m.opponents[1]?.name === "G2 Minnesota");
    expect(match?.timestamp).toBe(Date.parse("2026-11-07T20:00:00Z") / 1000);
    expect(match?.timeTbd).toBeFalsy();
    expect(match?.round).toBe("Upper Bracket Quarterfinals");
  });
});
