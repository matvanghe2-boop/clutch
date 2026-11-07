import { describe, expect, it } from "vitest";
import { orient } from "@/lib/derive";
import { emptySnapshot } from "@/lib/snapshot";
import { embeddable } from "@/lib/streams";
import { eveningKey, eveningOf, onAir } from "@/lib/tonight";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import type { Match, Snapshot } from "@/lib/types";

const cod = toFollowed(DEFAULT_TEAMS[2]);
const paris = { name: cod.page, page: cod.page };
const ts = (iso: string) => Date.parse(iso) / 1000;
const NOW = ts("2026-11-07T19:00:00Z"); // 20 h à Paris

const match = (id: string, timestamp: number | undefined, over: Partial<Match> = {}): Match => ({
  id,
  wiki: "callofduty",
  streams: [],
  games: [],
  timestamp,
  finished: false,
  opponents: [paris, { name: `Adversaire ${id}`, page: `Adversaire ${id}` }],
  scores: [null, null],
  ...over,
});

const snapshot = (upcoming: Match[]): Snapshot =>
  ({ ...emptySnapshot(), updatedAt: "x", teams: { [cod.id]: { id: cod.id, name: cod.page, upcoming, recent: [], roster: [], fetchedAt: "x" } } }) as unknown as Snapshot;

describe("une soirée", () => {
  it("un match à 1 h du matin appartient à la soirée de la veille", () => {
    expect(eveningKey(ts("2026-11-08T00:00:00Z"))).toBe("2026-11-07");
    expect(eveningKey(ts("2026-11-07T20:00:00Z"))).toBe("2026-11-07");
  });

  it("une nouvelle soirée commence à 6 h à Paris", () => {
    expect(eveningKey(ts("2026-11-08T04:59:00Z"))).toBe("2026-11-07");
    expect(eveningKey(ts("2026-11-08T05:01:00Z"))).toBe("2026-11-08");
  });

  it("garde l'heure de Paris à 2 h du matin, quand on regarde encore", () => {
    const late = ts("2026-11-08T01:00:00Z");
    const e = eveningOf(snapshot([match("a", ts("2026-11-08T02:00:00Z"))]), late);
    expect(e.tonight).toBe(true);
    expect(e.key).toBe("2026-11-07");
  });
});

describe("ce soir", () => {
  it("retient les matchs de la soirée, dans l'ordre, sans ceux de demain", () => {
    const e = eveningOf(snapshot([match("demain", ts("2026-11-08T20:00:00Z")), match("b", ts("2026-11-07T23:00:00Z")), match("a", ts("2026-11-07T20:00:00Z"))]), NOW);
    expect(e.tonight).toBe(true);
    expect(e.matches.map((o) => o.match.id)).toEqual(["a", "b"]);
  });

  it("sans match ce soir, annonce la prochaine soirée", () => {
    const e = eveningOf(snapshot([match("plus-tard", ts("2026-11-10T20:00:00Z"))]), NOW);
    expect(e.tonight).toBe(false);
    expect(e.key).toBe("2026-11-10");
    expect(e.matches.length).toBe(1);
  });

  it("met à part les matchs sans horaire", () => {
    const e = eveningOf(snapshot([match("sans", undefined), match("a", ts("2026-11-07T20:00:00Z"))]), NOW);
    expect(e.undated.map((o) => o.match.id)).toEqual(["sans"]);
    expect(e.matches.map((o) => o.match.id)).toEqual(["a"]);
  });

  it("sans aucun match, reste une soirée vide", () => {
    const e = eveningOf(snapshot([]), NOW);
    expect(e.tonight).toBe(true);
    expect(e.matches).toEqual([]);
  });
});

describe("à regarder maintenant", () => {
  const air = (m: Match) => onAir([orient(m, cod)], NOW).length === 1;

  it("un match en cours, ou qui commence dans l'heure", () => {
    expect(air(match("en-cours", NOW - 1800))).toBe(true);
    expect(air(match("bientot", NOW + 1800))).toBe(true);
  });

  it("pas un match plus lointain, sans heure sûre, ou terminé", () => {
    expect(air(match("loin", NOW + 7200))).toBe(false);
    expect(air(match("jour-seul", NOW + 1800, { timeTbd: true }))).toBe(false);
    expect(air(match("sans", undefined))).toBe(false);
    expect(air(match("fini", NOW - 1800, { finished: true }))).toBe(false);
  });
});

describe("plusieurs lecteurs", () => {
  const streams = [
    { platform: "twitch", channel: "a", url: "u" },
    { platform: "kick", channel: "b", url: "v" },
  ];

  it("coupe le son à la demande, et seulement à la demande", () => {
    const [twitch, kick] = embeddable(streams, "site.test", { muted: true });
    expect(twitch.src).toContain("&muted=true");
    expect(kick.src).toContain("?muted=true");
    expect(embeddable(streams, "site.test")[0].src).not.toContain("muted");
  });
});
