import { describe, expect, it } from "vitest";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import type { PastMatch } from "@/lib/derive";
import { isPlayer, lineupSince, pickEra, playedSince, rosterEras, titlesIn } from "@/lib/eras";
import { parseTeamPage } from "@/lib/liquipedia/team-page";
import type { Palmares } from "@/lib/types";
import { fixture } from "./fixtures";

const [rl, cs, cod] = DEFAULT_TEAMS.map(toFollowed);
const at = (iso: string) => Date.parse(`${iso}T20:00:00Z`) / 1000;
const played = (iso: string): PastMatch => ({ team: rl, timestamp: at(iso), opponent: { name: "X" }, usScore: "3", themScore: "0", result: "win", tournament: { name: "T" } });

describe("les passages dans le club", () => {
  it("garde les changements de rôle, que le jeu suit : un remplaçant ne joue plus", () => {
    const { stints } = parseTeamPage(fixture("team-cod-paris-gentle-mates.html"), cod);
    expect(stints.filter((s) => s.id === "Neptune").map((s) => [s.role, s.joined, s.left])).toEqual(
      expect.arrayContaining([
        [undefined, "2025-11-26", "2026-06-03"],
        ["Substitute", "2026-06-03", "2026-08-11"],
      ]),
    );
  });

  it("arrête un joueur écarté à la date de sa mise à l'écart, pas de son départ officiel", () => {
    const spinx = parseTeamPage(fixture("team-cs-vitality.html"), cs).stints.find((s) => s.id === "Spinx");
    expect(spinx?.left).toBe("2025-01-09");
  });

  it("reconnaît qui joue", () => {
    expect(["Coach", "Inactive Coach", "Substitute", "RFA", "Analyst"].some(isPlayer)).toBe(false);
    expect([undefined, "Captain", "IGL"].every(isPlayer)).toBe(true);
  });
});

describe("les périodes d'effectif", () => {
  const { roster, stints } = parseTeamPage(fixture("team-rl-gentle-mates.html"), rl);

  it("Gentle Mates : une équipe entièrement nouvelle, sans le coach parmi les joueurs", () => {
    const eras = rosterEras(roster, stints, [played("2026-11-05"), played("2026-06-01"), played("2025-06-01"), played("2025-01-10"), played("2024-06-01")]);
    expect(eras.map((e) => [e.from, e.players, e.results.length])).toEqual([
      ["2026-10-28", ["Atow", "Vatira", "zen"], 1],
      ["2025-10-11", ["Archie", "nass", "Oski"], 1],
      ["2025-04-12", ["juicy", "Seikoo", "yujin"], 1],
      ["2024-12-04", ["juicy", "Radosin", "Seikoo"], 1],
      ["2024-01-04", ["itachi", "juicy", "Seikoo"], 1],
    ]);
    expect(eras.map((e) => e.current)).toEqual([true, false, false, false, false]);
  });

  it("un match le jour d'une arrivée est joué par le nouvel effectif", () => {
    const eras = rosterEras(roster, stints, [played("2026-10-28")]);
    expect(eras[0].results.length).toBe(1);
  });

  it("l'effectif actuel existe même sans match ; les jours entre deux équipes, non", () => {
    const eras = rosterEras(roster, stints, [played("2026-10-27")]);
    expect(eras.map((e) => e.from)).toEqual(["2026-10-28"]);
    expect(eras[0].results).toEqual([]);
  });

  it("une ligne en double ne coupe pas une période", () => {
    const eras = rosterEras(
      [{ id: "a", joined: "2025-01-01" }, { id: "b", joined: "2025-06-01" }],
      [{ id: "b", joined: "2025-01-01", left: "2025-06-01" }],
      [played("2025-03-01"), played("2025-09-01")],
    );
    expect(eras.map((e) => [e.from, e.results.length])).toEqual([["2025-01-01", 2]]);
  });

  it("choisit l'effectif actuel par défaut, et tout l'historique sur demande", () => {
    const eras = rosterEras(roster, stints, [played("2025-06-01")]);
    expect(pickEra(eras, undefined)?.current).toBe(true);
    expect(pickEra(eras, "inconnu")?.current).toBe(true);
    expect(pickEra(eras, "2025-04-12")?.from).toBe("2025-04-12");
    expect(pickEra(eras, "tout")).toBeUndefined();
  });

  it("sans donnée, aucune période", () => {
    expect(rosterEras([], [], [played("2025-06-01")])).toEqual([]);
  });
});

describe("autour de l'effectif en place", () => {
  it("il joue ensemble depuis la dernière arrivée d'un joueur, pas d'un coach", () => {
    expect(lineupSince([{ id: "a", joined: "2025-01-01" }, { id: "b", joined: "2025-06-01" }, { id: "c", role: "Coach", joined: "2026-01-01" }])).toBe("2025-06-01");
    expect(lineupSince([])).toBeUndefined();
  });

  it("compte ses matchs parmi les derniers résultats", () => {
    expect(playedSince([played("2026-11-05"), played("2026-10-28"), played("2026-10-20")], "2026-10-28")).toBe(2);
    expect(playedSince([played("2026-11-05")], undefined)).toBe(0);
  });

  const palmares = (rows: Palmares["rows"], events = rows.length): Palmares => ({ rows, events, titles: 0, finals: 0, podiums: 0, majorTitles: 0, fetchedAt: "x" });
  const row = (date: string, rank?: number) => ({ date, place: "x", rank, tournament: { name: "T" } });
  const era = { from: "2025-01-01", to: "2026-01-01", players: ["a"], current: false, results: [] };

  it("compte les titres de la période", () => {
    expect(titlesIn(era, palmares([row("2026-05-01", 1), row("2025-05-01", 1), row("2025-04-01", 2), row("2024-05-01", 1)]))).toBe(1);
  });

  it("ne dit rien si le palmarès gardé ne remonte pas jusque-là", () => {
    expect(titlesIn(era, palmares([row("2025-05-01", 1)], 100))).toBeUndefined();
    expect(titlesIn(era, undefined)).toBeUndefined();
  });
});
