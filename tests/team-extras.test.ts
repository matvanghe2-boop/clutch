import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import { parseMatchHistory, parsePalmares, parseTeamPage } from "@/lib/liquipedia/team-page";
import { parseTournamentPage } from "@/lib/liquipedia/tournament-page";
import { tournamentMatches } from "@/lib/tournament";
import { atCaptureDate, fixture } from "./fixtures";

const [rl, cs, cod] = DEFAULT_TEAMS.map(toFollowed);

beforeAll(atCaptureDate);
afterAll(() => vi.useRealTimers());

describe("carte d'identité", () => {
  it("Gentle Mates : gains, note Liquipedia, manager, création", () => {
    const { info } = parseTeamPage(fixture("team-rl-gentle-mates.html"), rl);
    expect(info).toMatchObject({ location: "France", region: "Europe", created: "2024-01-04" });
    expect(info?.winnings).toMatch(/^\$[\d,]+$/);
    expect(info?.lpRating).toBeGreaterThan(1000);
    expect(info?.lpRank).toBeGreaterThan(0);
    expect(info?.staff).toEqual([{ role: "Manager", names: ['Thomas "AzoX" Albanese'] }]);
  });

  it("Vitality : un nom par personne, le pays et non le drapeau", () => {
    const { info } = parseTeamPage(fixture("team-cs-vitality.html"), cs);
    expect(info?.location).toBe("France");
    expect(info?.created).toBe("2013-08-05");
    expect(info?.staff.find((s) => s.role === "Fondateurs")?.names).toEqual(["Nicolas Maurer", "Fabien Devide"]);
    expect(info?.staff.find((s) => s.role === "IGL")?.names).toEqual(["apEX"]);
    expect(info?.lpRating).toBeUndefined();
  });
});

describe("anciens joueurs", () => {
  it("du départ le plus récent au plus ancien, sans doublon, avec leur nouvelle équipe", () => {
    const { former } = parseTeamPage(fixture("team-cs-vitality.html"), cs);
    expect(former.length).toBeGreaterThan(3);
    expect(former.length).toBeLessThanOrEqual(15);
    expect(former[0]).toMatchObject({ id: "Spinx", joined: "2022-08-15", left: "2025-01-23", next: "MOUZ" });
    const lefts = former.map((f) => f.left ?? "");
    expect([...lefts].sort().reverse()).toEqual(lefts);
    expect(new Set(former.map((f) => `${f.id}|${f.joined}`)).size).toBe(former.length);
  });

  it("Paris Gentle Mates a aussi les siens", () => {
    expect(parseTeamPage(fixture("team-cod-paris-gentle-mates.html"), cod).former.length).toBeGreaterThan(0);
  });
});

describe("distinctions et records", () => {
  it("Rocket League : un MVP par joueur, avec sa compétition", () => {
    const { awards } = parseTeamPage(fixture("team-rl-gentle-mates.html"), rl);
    expect(awards[0]).toMatchObject({ award: "Boston Major MVP", player: "nass", tier: "S-Tier", date: "2026-02-22" });
    expect(awards[0].tournament).toContain("Boston Major");
  });

  it("Vitality : des titres du club en texte, des records sans les intitulés de catégorie ni les renvois", () => {
    const { awards, records } = parseTeamPage(fixture("team-cs-vitality.html"), cs);
    expect(awards[0].award).toContain("Team of the Year");
    expect(awards[0].award).not.toMatch(/\[\d+\]/);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r).not.toMatch(/:$/);
      expect(r).not.toMatch(/\[\d+\]/);
    }
  });

  it("une équipe sans ces sections n'a rien d'inventé", () => {
    const { awards, records } = parseTeamPage(fixture("team-cod-paris-gentle-mates.html"), cod);
    expect(awards).toEqual([]);
    expect(records).toEqual([]);
  });
});

describe("palmarès", () => {
  const p = parsePalmares(fixture("results-cs-vitality.html"));

  it("ne compte comme titre qu'une première place exacte, pas une plage de phase de groupes", () => {
    expect(p.titles).toBe(42);
    expect(p.majorTitles).toBe(28);
    expect(p.finals).toBe(23);
    expect(p.rows.filter((r) => r.place === "1st - 3rd").every((r) => r.rank === undefined)).toBe(true);
  });

  it("garde les compétitions récentes, avec date, niveau, lien et gains", () => {
    expect(p.events).toBeGreaterThan(p.rows.length);
    expect(p.rows.length).toBe(40);
    expect(p.rows[0]).toMatchObject({
      date: "2026-10-31",
      place: "4th",
      rank: 4,
      tier: "S-Tier",
      tournament: { name: "PGL Masters Bucharest 2026", page: "PGL/2026/Masters" },
      prize: "$87,500",
    });
  });
});

describe("historique sous le nom « Played Matches »", () => {
  const history = parseMatchHistory(fixture("history-rl-gentle-mates.html"));

  it("lit des années de matchs de Gentle Mates", () => {
    expect(history.length).toBeGreaterThan(200);
    expect(new Date(Math.min(...history.map((m) => m.timestamp)) * 1000).getUTCFullYear()).toBe(2024);
    for (const m of history) {
      expect(m.score[1]).not.toBe("");
      expect(m.opponent?.name).toBeTruthy();
    }
  });
});

describe("manches CDL", () => {
  it("lit le mode de jeu à côté de la carte", () => {
    const t = parseTournamentPage(fixture("tournament-cod-s7-playoffs.html"), "callofduty", "Call of Duty League/Season 7/Playoffs");
    const games = tournamentMatches(t)
      .filter((m) => m.finished)
      .flatMap((m) => m.games)
      .filter((g) => g.score1 && g.score2);
    expect(games.length).toBeGreaterThan(30);
    expect(new Set(games.map((g) => g.mode))).toEqual(new Set(["Hardpoint", "Search and Destroy", "Overload"]));
  });
});
