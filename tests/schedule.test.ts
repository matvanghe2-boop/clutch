import { describe, expect, it } from "vitest";
import { DEFAULT_TEAMS, toFollowed } from "@/config/follow";
import { upcomingFeed } from "@/lib/derive";
import { emptySnapshot } from "@/lib/snapshot";
import { moveOf, notesFor, recordMoves, scheduleOf } from "@/lib/schedule";
import type { Match, RecentMatch, Snapshot } from "@/lib/types";

const cod = toFollowed(DEFAULT_TEAMS[2]);
const cs = toFollowed(DEFAULT_TEAMS[1]);
const ts = (iso: string) => Date.parse(iso) / 1000;
const NOW = Date.parse("2026-11-07T12:00:00Z");

const match = (team: typeof cod, opponent: string, timestamp: number | undefined, over: Partial<Match> = {}): Match => ({
  id: `${team.game}:${timestamp ?? "nodate"}:${opponent}`,
  wiki: team.game,
  streams: [],
  games: [],
  timestamp,
  finished: false,
  opponents: [{ name: team.page, page: team.page }, { name: opponent, page: opponent }],
  scores: [null, null],
  ...over,
});

const snapshot = (codMatches: Match[], csMatches: Match[] = [], recent: RecentMatch[] = []): Snapshot =>
  ({
    ...emptySnapshot(),
    updatedAt: "x",
    teams: {
      [cod.id]: { id: cod.id, name: cod.page, upcoming: codMatches, recent, roster: [], fetchedAt: "x" },
      [cs.id]: { id: cs.id, name: cs.page, upcoming: csMatches, recent: [], roster: [], fetchedAt: "x" },
    },
  }) as unknown as Snapshot;

describe("heure changée", () => {
  it("note un match avancé ou repoussé", () => {
    const snap = snapshot([match(cod, "Toronto KOI", ts("2026-11-08T19:00:00Z"))]);
    const before = scheduleOf(snap);
    snap.teams[cod.id].upcoming = [match(cod, "Toronto KOI", ts("2026-11-08T21:00:00Z"))];
    recordMoves(snap, before, NOW);
    const [o] = upcomingFeed(snap);
    expect(moveOf(snap, o)).toMatchObject({ from: ts("2026-11-08T19:00:00Z"), to: ts("2026-11-08T21:00:00Z") });
  });

  it("ne confond pas une heure qui arrive avec un déplacement", () => {
    const snap = snapshot([match(cod, "Toronto KOI", ts("2026-11-08T22:59:00Z"), { timeTbd: true })]);
    const before = scheduleOf(snap);
    snap.teams[cod.id].upcoming = [match(cod, "Toronto KOI", ts("2026-11-08T19:00:00Z"))];
    recordMoves(snap, before, NOW);
    expect(snap.moves).toBeUndefined();
  });

  it("garde la première heure, et oublie un match revenu à son horaire", () => {
    const snap = snapshot([match(cod, "Toronto KOI", ts("2026-11-08T19:00:00Z"))]);
    for (const hour of ["20", "21"]) {
      const before = scheduleOf(snap);
      snap.teams[cod.id].upcoming = [match(cod, "Toronto KOI", ts(`2026-11-08T${hour}:00:00Z`))];
      recordMoves(snap, before, NOW);
    }
    expect(Object.values(snap.moves ?? {})[0]?.from).toBe(ts("2026-11-08T19:00:00Z"));
    const before = scheduleOf(snap);
    snap.teams[cod.id].upcoming = [match(cod, "Toronto KOI", ts("2026-11-08T19:00:00Z"))];
    recordMoves(snap, before, NOW);
    expect(snap.moves).toBeUndefined();
  });

  it("ne prend pas une revanche pour un déplacement", () => {
    const first = ts("2026-11-08T19:00:00Z");
    const snap = snapshot([match(cod, "Toronto KOI", first)]);
    const before = scheduleOf(snap);
    const played: RecentMatch = { timestamp: first, tournament: { name: "Major" }, score: ["3", "1"], result: "win", opponent: { name: "Toronto KOI", page: "Toronto KOI" } };
    snap.teams[cod.id].upcoming = [match(cod, "Toronto KOI", ts("2026-11-09T19:00:00Z"))];
    snap.teams[cod.id].recent = [played];
    recordMoves(snap, before, NOW);
    expect(snap.moves).toBeUndefined();
  });
});

describe("matchs en même temps", () => {
  it("signale deux de mes équipes qui jouent à la même heure, pas l'une après l'autre", () => {
    const snap = snapshot(
      [match(cod, "Toronto KOI", ts("2026-11-08T19:00:00Z"), { bestOf: 5 }), match(cod, "OpTic Texas", ts("2026-11-09T23:00:00Z"), { bestOf: 5 })],
      [match(cs, "FaZe", ts("2026-11-08T20:30:00Z"), { bestOf: 3 }), match(cs, "NaVi", ts("2026-11-09T18:00:00Z"), { bestOf: 3 })],
    );
    const notes = notesFor(snap, upcomingFeed(snap));
    const clashing = [...notes.entries()].filter(([, n]) => n.clash).map(([id]) => id);
    expect(clashing.sort()).toEqual([`callofduty:${ts("2026-11-08T19:00:00Z")}:Toronto KOI`, `counterstrike:${ts("2026-11-08T20:30:00Z")}:FaZe`].sort());
  });
});
