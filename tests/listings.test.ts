import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { dayFromText, timerFrom } from "@/lib/liquipedia/html";
import { parseListing, parseRange } from "@/lib/liquipedia/listing";
import { parsePortal } from "@/lib/liquipedia/portal";
import { CAPTURED_AT, fixture } from "./fixtures";

const TODAY = "2026-11-04";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

describe("listes par niveau (« S-Tier Tournaments »)", () => {
  it.each([
    ["rocketleague", "listing-rl-s-tier.html"],
    ["counterstrike", "listing-cs-s-tier.html"],
    ["callofduty", "listing-cod-s-tier.html"],
  ] as const)("%s : ne garde que les compétitions pas encore terminées, bien datées", (wiki, file) => {
    const entries = parseListing(fixture(file), wiki, "S-Tier Tournaments", TODAY);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e).toMatchObject({ wiki, tier: "S-Tier" });
      expect(e.page).toBeTruthy();
      expect(["upcoming", "ongoing"]).toContain(e.status);
      if (e.startDate) expect(e.startDate).toMatch(ISO_DAY);
      if (e.endDate) expect(e.endDate >= TODAY).toBe(true);
    }
  });

  it("Rocket League : le Kick-Off de Londres, avant même la liste des qualifiés", () => {
    const [kickoff] = parseListing(fixture("listing-rl-s-tier.html"), "rocketleague", "S-Tier Tournaments", TODAY);
    expect(kickoff).toMatchObject({
      page: "Rocket League Championship Series/Club Championship/2027/Kick-Off",
      startDate: "2026-12-09",
      endDate: "2026-12-13",
      location: "London",
      prize: "$300,000",
    });
  });

  it("Counter-Strike : plusieurs dizaines d'entrées, y compris l'an prochain", () => {
    const entries = parseListing(fixture("listing-cs-s-tier.html"), "counterstrike", "S-Tier Tournaments", TODAY);
    expect(entries.length).toBeGreaterThan(20);
    expect(entries.some((e) => e.startDate?.startsWith("2027"))).toBe(true);
  });
});

describe("Liquipedia:Tournaments (wikitexte)", () => {
  it("lit les étapes RLCS à venir et déduit l'année", () => {
    const entries = parsePortal(fixture("portal-rl.wiki"), "rocketleague", CAPTURED_AT);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toEqual({
      wiki: "rocketleague",
      page: "Rocket League Championship Series/Club Championship/2027/Kick-Off/Europe",
      name: "RLCS 2027 - Kick-Off: EU",
      status: "upcoming",
      startDate: "2026-11-13",
      endDate: "2026-11-22",
    });
  });

  it("une compétition de janvier lue en novembre est l'an prochain", () => {
    const text = "*Upcoming\n** Some/Event | Event | startdate=Jan 10 | enddate=Jan 12\n";
    expect(parsePortal(text, "rocketleague", CAPTURED_AT)[0]).toMatchObject({ startDate: "2027-01-10", endDate: "2027-01-12" });
  });
});

describe("dates", () => {
  it.each([
    ["Dec 09–13, 2026", { start: "2026-12-09", end: "2026-12-13" }],
    ["Nov 22 - Dec 12, 2027", { start: "2027-11-22", end: "2027-12-12" }],
    ["Dec 28 – Jan 03, 2027", { start: "2026-12-28", end: "2027-01-03" }],
    ["Nov 05, 2026", { start: "2026-11-05", end: "2026-11-05" }],
    ["TBA", {}],
    ["Dec, 2026", {}],
  ])("parseRange(%j)", (raw, expected) => {
    expect(parseRange(raw)).toEqual(expected);
  });

  it("dayFromText : avec ou sans année", () => {
    expect(dayFromText("November 7, 2026")).toBe("2026-11-07");
    expect(dayFromText("Jan 3", CAPTURED_AT)).toBe("2027-01-03");
    expect(dayFromText("Oct 30", CAPTURED_AT)).toBe("2026-10-30");
    expect(dayFromText("demain")).toBeUndefined();
  });

  it("timerFrom : jour connu sans heure → 21 h UTC, signalé", () => {
    const $ = cheerio.load('<div id="a"><span class="timer-object" data-timestamp="1794002400">November 7, 2026</span></div>');
    expect(timerFrom($("#a"))).toEqual({ timestamp: Date.parse("2026-11-07T21:00:00Z") / 1000, finished: false, timeTbd: true });
  });

  it("timerFrom : heure connue → horodatage de Liquipedia", () => {
    const $ = cheerio.load('<div id="a"><span class="timer-object" data-timestamp="1794002400" data-finished="finished">November 7, 2026 - 18:00 CET</span></div>');
    expect(timerFrom($("#a"))).toEqual({ timestamp: 1794002400, finished: true });
  });
});
