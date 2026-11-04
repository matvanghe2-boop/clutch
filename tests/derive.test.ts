import { describe, expect, it } from "vitest";
import { headToHead, recentFeed, upcomingFeed } from "@/lib/derive";
import { emptySnapshot } from "@/lib/snapshot";
import type { Match, RecentMatch, Snapshot, TeamRef } from "@/lib/types";

const M8: TeamRef = { name: "Gentle Mates", page: "Gentle Mates", short: "M8" };
const DUM: TeamRef = { name: "DUMORNAY GOAT", page: "DUMORNAY GOAT", short: "DUM" };
const VIT: TeamRef = { name: "Team Vitality", page: "Team Vitality", short: "VIT" };
const CDF = { name: "Coupe de France Slash 2026", page: "NEO/Coupe de France Slash/2026" };
const T0 = Date.parse("2026-11-04T19:15:00Z") / 1000;

const match = (id: string, timestamp: number, b: TeamRef, done?: { scores: [string, string]; winner: 1 | 2 }): Match => ({
  id,
  wiki: "rocketleague",
  timestamp,
  finished: Boolean(done),
  opponents: [M8, b],
  scores: done?.scores ?? [null, null],
  winner: done?.winner,
  tournament: CDF,
  streams: [],
  games: [],
});

const earlier: RecentMatch = { timestamp: T0 - 86400, tournament: CDF, score: ["3", "1"], result: "win", opponent: VIT };

/**
 * Le soir du match : la page de compétition a le score (3-0), la page de
 * l'équipe annonce encore le match « à venir » et n'a pas le résultat.
 */
function snapshot(teamPageHasResult = false): Snapshot {
  const snap = emptySnapshot();
  snap.teams["m8-rl"] = {
    id: "m8-rl",
    name: "Gentle Mates",
    upcoming: teamPageHasResult ? [match("next", T0 + 5 * 86400, VIT)] : [match("team-page", T0, DUM), match("next", T0 + 5 * 86400, VIT)],
    recent: teamPageHasResult ? [{ timestamp: T0, tournament: CDF, score: ["3", "0"], result: "win", opponent: DUM }, earlier] : [earlier],
    fetchedAt: "2026-11-04T20:45:00Z",
  };
  snap.tournaments[`rocketleague:${CDF.page}`] = {
    key: `rocketleague:${CDF.page}`,
    wiki: "rocketleague",
    page: CDF.page,
    name: CDF.name,
    info: {},
    participating: true,
    fetchedAt: "2026-11-04T20:46:00Z",
    stages: [
      {
        title: "League Play",
        anchor: "League_Play",
        // L'ordre des équipes peut être inversé sur la page de compétition.
        blocks: [{ kind: "matchlist", list: { title: "Day 3", matches: [{ ...match("tournament", T0, DUM, { scores: ["0", "3"], winner: 2 }), opponents: [DUM, M8] }] } }],
      },
    ],
  };
  return snap;
}

describe("un match terminé que la page d'équipe annonce encore", () => {
  it("quitte les matchs à venir", () => {
    const feed = upcomingFeed(snapshot());
    expect(feed.map((o) => o.them?.name)).toEqual(["Team Vitality"]);
  });

  it("apparaît tout de suite dans les derniers résultats, vu de l'équipe suivie", () => {
    const [first, second] = recentFeed(snapshot());
    expect(first).toMatchObject({ opponent: DUM, usScore: "3", themScore: "0", result: "win", timestamp: T0 });
    expect(second.opponent).toEqual(VIT);
  });

  it("n'est pas compté deux fois une fois la page d'équipe à jour", () => {
    const feed = recentFeed(snapshot(true));
    expect(feed.filter((r) => r.opponent?.name === "DUMORNAY GOAT")).toHaveLength(1);
    expect(feed).toHaveLength(2);
  });

  it("compte dans le face-à-face", () => {
    const h2h = headToHead(snapshot(), recentFeed(snapshot())[0].team, DUM);
    expect(h2h).toMatchObject({ wins: 1, losses: 0 });
  });
});
