import { describe, expect, it } from "vitest";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import { pruneSent, pushEvents } from "@/lib/push/events";
import { emptySnapshot } from "@/lib/snapshot";
import type { Match, RecentMatch, Snapshot } from "@/lib/types";

const cod = toFollowed(DEFAULT_TEAMS[2]);
const NOW = Date.parse("2026-11-12T19:00:00Z") / 1000;

const match = (opponent: string, timestamp: number | undefined, over: Partial<Match> = {}): Match => ({
  id: `callofduty:${timestamp ?? "nodate"}:${opponent}`,
  wiki: "callofduty",
  streams: [],
  games: [],
  timestamp,
  finished: false,
  opponents: [{ name: cod.page, page: cod.page }, { name: opponent, page: opponent }],
  scores: [null, null],
  tournament: { name: "CDL Major 1" },
  ...over,
});

const snapshot = (upcoming: Match[], recent: RecentMatch[] = []): Snapshot =>
  ({ ...emptySnapshot(), updatedAt: "x", teams: { [cod.id]: { id: cod.id, name: cod.page, upcoming, recent, roster: [], fetchedAt: "x" } } }) as unknown as Snapshot;

describe("notifications", () => {
  it("rappelle un match un quart d'heure avant, une seule fois, et pas un match sans heure", () => {
    const snap = snapshot([match("Toronto KOI", NOW + 12 * 60), match("OpTic Texas", NOW + 40 * 60), match("FaZe Vegas", NOW + 10 * 60, { timeTbd: true })]);
    const events = pushEvents(snap, NOW, {});
    expect(events.map((e) => e.payload.title)).toEqual(["Dans 12 min : Paris Gentle Mates – Toronto KOI"]);
    const sent = { [events[0].key]: { at: "x" } };
    expect(pushEvents(snap, NOW, sent)).toEqual([]);
  });

  it("annonce chaque manche du direct, avec qui la prend", () => {
    const live = (a: string, b: string) => snapshot([match("Toronto KOI", NOW - 1800, { scores: [a, b] })]);
    const first = pushEvents(live("1", "0"), NOW, {});
    expect(first[0]).toMatchObject({ kind: "score", value: "1-0", payload: { title: "Paris Gentle Mates 1–0 Toronto KOI" } });
    expect(first[0].payload.body).toMatch(/^Paris Gentle Mates prend la manche/);
    const sent = { [first[0].key]: { at: "x", value: "1-0" } };
    expect(pushEvents(live("1", "0"), NOW, sent)).toEqual([]);
    expect(pushEvents(live("1", "1"), NOW, sent)[0].payload.body).toMatch(/^Toronto KOI prend la manche/);
  });

  it("donne le résultat d'un match fini récemment, pas celui d'il y a deux jours", () => {
    const recent: RecentMatch[] = [
      { timestamp: NOW - 3 * 3600, tournament: { name: "CDL Major 1" }, score: ["3", "1"], result: "win", opponent: { name: "Toronto KOI", page: "Toronto KOI" } },
      { timestamp: NOW - 2 * 86400, tournament: { name: "CDL Major 1" }, score: ["0", "3"], result: "loss", opponent: { name: "OpTic Texas", page: "OpTic Texas" } },
    ];
    const events = pushEvents(snapshot([], recent), NOW, {});
    expect(events.map((e) => e.payload.title)).toEqual(["Victoire 3–1 contre Toronto KOI"]);
  });

  it("signale une heure changée", () => {
    const snap = snapshot([match("Toronto KOI", NOW + 3 * 3600)]);
    snap.moves = { [`${cod.id}:toronto koi`]: { from: NOW + 3600, to: NOW + 3 * 3600, at: new Date((NOW - 600) * 1000).toISOString() } };
    const [e] = pushEvents(snap, NOW, {});
    expect(e).toMatchObject({ kind: "schedule", payload: { title: "Heure changée : Paris Gentle Mates – Toronto KOI" } });
  });

  it("oublie le journal au bout de trois jours", () => {
    const old = new Date((NOW - 4 * 86400) * 1000).toISOString();
    const fresh = new Date((NOW - 3600) * 1000).toISOString();
    expect(Object.keys(pruneSent({ a: { at: old }, b: { at: fresh } }, NOW))).toEqual(["b"]);
  });
});
