import { describe, expect, it } from "vitest";
import { parseSeasonStandings, parseVrs } from "@/lib/liquipedia/rankings";
import { fixture } from "./fixtures";

describe("classement Valve (VRS)", () => {
  const vrs = parseVrs(fixture("ranking-cs-vrs.html"), "Valve Regional Standings");

  it("lit le classement mondial complet, dans l'ordre, avec sa date", () => {
    expect(vrs.updated).toBe("2026-11-02");
    expect(vrs.rows.length).toBeGreaterThan(300);
    expect(vrs.rows.slice(0, 5).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(vrs.rows[0]).toMatchObject({ team: { name: "MOUZ", page: "MOUZ" }, points: "1960.4", region: "EU" });
  });

  it("complète chaque équipe de son rang dans sa région", () => {
    const vitality = vrs.rows.find((r) => r.team.page === "Team Vitality");
    expect(vitality).toMatchObject({ rank: 2, points: "1921.9", regionRank: 2, regionName: "Europe" });
    const furia = vrs.rows.find((r) => r.team.name === "FURIA");
    expect(furia).toMatchObject({ regionRank: 1, regionName: "Americas" });
  });
});

describe("classement de saison régulière CDL", () => {
  const cdl = parseSeasonStandings(fixture("ranking-cod-s7-regular-season.html"), "Call of Duty League/Season 7/Regular Season", "CDL saison 7");

  it("lit les douze équipes et les colonnes du tableau", () => {
    expect(cdl.columns).toEqual(["Match", "Game", "Pts", "Win%", "GD"]);
    expect(cdl.rows).toHaveLength(12);
    expect(cdl.rows[0]).toMatchObject({ rank: 1, team: { name: "OpTic Texas" }, cells: ["40-12", "139-70", "575", "76.92%", "+69"] });
  });

  it("retrouve Paris Gentle Mates", () => {
    expect(cdl.rows.find((r) => r.team.page === "Paris Gentle Mates")).toMatchObject({ rank: 4, cells: ["29-23", "109-101", "380", "55.77%", "+8"] });
  });
});
