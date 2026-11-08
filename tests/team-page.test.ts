import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import { parseMatchHistory, parseTeamPage } from "@/lib/liquipedia/team-page";
import type { RecentMatch } from "@/lib/types";
import { atCaptureDate, fixture } from "./fixtures";

const [rl, cs, cod] = DEFAULT_TEAMS.map(toFollowed);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

beforeAll(atCaptureDate);
afterAll(() => vi.useRealTimers());

/** Un résultat cohérent avec son score, vu de l'équipe suivie. */
function expectConsistent(m: RecentMatch) {
  expect(m.timestamp).toBeGreaterThan(Date.parse("2015-01-01") / 1000);
  expect(m.opponent?.name).toBeTruthy();
  expect(m.tournament.name).toBeTruthy();
  const [a, b] = m.score.map(Number);
  if (Number.isFinite(a) && Number.isFinite(b)) expect(m.result).toBe(a > b ? "win" : a < b ? "loss" : "draw");
}

describe.each([
  { label: "Rocket League · Gentle Mates", file: "team-rl-gentle-mates.html", team: rl },
  { label: "CS2 · Team Vitality", file: "team-cs-vitality.html", team: cs },
  { label: "CDL · Paris Gentle Mates", file: "team-cod-paris-gentle-mates.html", team: cod },
])("page d'équipe $label", ({ file, team }) => {
  const page = parseTeamPage(fixture(file), team);

  it("trouve le logo", () => {
    expect(page.logo).toMatch(/^https:\/\/liquipedia\.net\/commons\/images\//);
  });

  it("lit les dix derniers résultats, cohérents avec leur score", () => {
    expect(page.recent).toHaveLength(10);
    page.recent.forEach(expectConsistent);
    const times = page.recent.map((m) => m.timestamp);
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("place l'équipe suivie en premier dans les matchs à venir", () => {
    for (const m of page.upcoming) {
      expect(m.opponents[0]?.name).toBe(team.page);
      expect(m.tournament?.page).toBeTruthy();
      expect(m.timestamp).toBeGreaterThan(Date.parse("2026-11-04") / 1000);
    }
  });

  it("lit l'effectif", () => {
    expect(page.roster.length).toBeGreaterThanOrEqual(3);
    for (const p of page.roster) {
      expect(p.id).toBeTruthy();
      if (p.joined) expect(p.joined).toMatch(ISO_DAY);
    }
  });

  it("lit les derniers mouvements, sans renvois de notes", () => {
    expect(page.timeline.length).toBeGreaterThan(0);
    expect(page.timeline.length).toBeLessThanOrEqual(6);
    for (const line of page.timeline) expect(line).not.toMatch(/\[\d+\]/);
  });
});

describe("détails par équipe", () => {
  it("Gentle Mates (RL) : cinq matchs à venir en Coupe de France, avec la journée", () => {
    const { upcoming, roster } = parseTeamPage(fixture("team-rl-gentle-mates.html"), rl);
    expect(upcoming).toHaveLength(5);
    expect(upcoming[0].opponents[1]?.name).toBe("DUMORNAY GOAT");
    expect(upcoming[0].tournament).toMatchObject({ page: "NEO/Coupe de France Slash/2026", stage: "Day 3" });
    expect(new Date(upcoming[0].timestamp! * 1000).toISOString()).toBe("2026-11-04T19:15:00.000Z");
    expect(roster.map((p) => p.id)).toEqual(expect.arrayContaining(["Vatira", "Atow"]));
  });

  it("Team Vitality (CS2) : nouveau format de tableau, capitaine repéré", () => {
    const { upcoming, recent, roster } = parseTeamPage(fixture("team-cs-vitality.html"), cs);
    expect(upcoming[0].opponents[1]?.name).toBe("Team Falcons");
    expect(upcoming[0].tournament?.page).toBe("BLAST/Rivals/2026/Fall");
    expect(recent[0]).toMatchObject({ result: "loss", score: ["0", "2"], tier: "S-Tier" });
    expect(recent[0].opponent?.short).toBe("MOUZ");
    expect(roster.find((p) => p.id === "apEX")?.captain).toBe(true);
    // Le titre de la page du joueur, où se lit sa photo (MediaWiki met une majuscule).
    expect(roster.find((p) => p.id === "apEX")?.page).toBe("ApEX");
    expect(roster.every((p) => p.page)).toBe(true);
  });

  it("Paris Gentle Mates (CDL) : aucun match annoncé, statut RFA lu", () => {
    const { upcoming, recent, roster } = parseTeamPage(fixture("team-cod-paris-gentle-mates.html"), cod);
    expect(upcoming).toHaveLength(0);
    expect(recent[0].tournament.page).toBe("Call of Duty League/Season 7/Playoffs");
    expect(recent[0]).toMatchObject({ result: "loss", score: ["2", "3"] });
    expect(roster.find((p) => p.id === "Estreal")?.role).toBe("RFA");
  });
});

describe("historique complet (page Équipe/Matches)", () => {
  const history = parseMatchHistory(fixture("matches-cs-vitality.html"));

  it("lit plusieurs saisons de matchs, du plus récent au plus ancien", () => {
    expect(history.length).toBeGreaterThan(200);
    const times = history.map((m) => m.timestamp);
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    expect(new Date(times.at(-1)! * 1000).getUTCFullYear()).toBeLessThanOrEqual(2023);
  });

  it("donne à chaque match un adversaire et un résultat cohérent", () => {
    history.forEach(expectConsistent);
  });

  it("découpe aussi le score d'un Bo1 (« 13 - 4 », le score de la carte)", () => {
    for (const m of history) expect(m.score[1]).not.toBe("");
    expect(history.some((m) => Number(m.score[0]) >= 13 || Number(m.score[1]) >= 13)).toBe(true);
  });
});
