import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { kind: string; params: Record<string, string> }[] = [];
vi.mock("@/lib/liquipedia/client", () => ({
  apiQuery: vi.fn(async (_wiki: string, params: Record<string, string>) => {
    calls.push({ kind: "wiki", params });
    return {
      query: {
        normalized: [{ from: "apEX", to: "ApEX" }],
        redirects: [{ from: "Zen", to: "Zen (player)" }],
        pages: [
          { title: "ApEX", pageprops: { metaimage: "ApEX at BLAST Open Spring 2026.jpg" } },
          { title: "Zen (player)", pageprops: { metaimage: "Zen at RLCS.jpg" } },
          { title: "Nobody", missing: true },
        ],
      },
    };
  }),
  commonsQuery: vi.fn(async (params: Record<string, string>) => {
    calls.push({ kind: "commons", params });
    return {
      query: {
        pages: [
          {
            title: "File:ApEX at BLAST Open Spring 2026.jpg",
            imageinfo: [{ thumburl: "https://liquipedia.net/commons/images/thumb/a/ab/ApEX.jpg/480px-ApEX.jpg", descriptionurl: "https://liquipedia.net/commons/File:ApEX.jpg" }],
            revisions: [{ slots: { main: { content: "{{FileInfo\n|license=permission\n|author=Stephanie Lindgren\n|copyright=[https://about.blast.tv/ BLAST]\n}}" } } }],
          },
          { title: "File:Zen at RLCS.jpg", imageinfo: [{ url: "https://liquipedia.net/commons/images/z/zz/Zen.jpg" }], revisions: [{ slots: { main: { content: "|author=[[User:Someone|Aleksander]]" } } }] },
        ],
      },
    };
  }),
}));

const { fetchPhotos, infoField, photoKey, stalePhotos } = await import("@/lib/sync/photos");
const { photoCredit, rosterPhotos } = await import("@/lib/photos");
const { emptySnapshot } = await import("@/lib/snapshot");
const { DEFAULT_TEAMS, toFollowed } = await import("@/config/follow");

beforeEach(() => {
  calls.length = 0;
});

describe("photos de joueurs", () => {
  it("lit l'auteur et les droits sans les liens du wikitexte", () => {
    const text = "|author=Stephanie Lindgren\n|copyright=[https://about.blast.tv/ BLAST]\n|note=[[Liquipedia:Copyrights|voir]]";
    expect(infoField(text, "author")).toBe("Stephanie Lindgren");
    expect(infoField(text, "copyright")).toBe("BLAST");
    expect(infoField(text, "note")).toBe("voir");
    expect(infoField(text, "license")).toBeUndefined();
  });

  it("suit majuscules et redirections, et note aussi les joueurs sans photo", async () => {
    const found = await fetchPhotos("counterstrike", ["apEX", "Zen", "Nobody"]);
    expect(calls.map((c) => c.kind)).toEqual(["wiki", "commons"]);
    expect(found[photoKey("counterstrike", "apEX")]).toMatchObject({ src: expect.stringContaining("480px-ApEX"), author: "Stephanie Lindgren", owner: "BLAST" });
    expect(found[photoKey("counterstrike", "Zen")]).toMatchObject({ src: expect.stringContaining("Zen.jpg"), author: "Aleksander" });
    expect(found[photoKey("counterstrike", "Nobody")].src).toBeUndefined();
    expect(photoCredit(found[photoKey("counterstrike", "apEX")])).toBe("Photo Stephanie Lindgren · BLAST");
  });

  it("ne redemande une photo qu'au bout de deux semaines, et ne la montre qu'au navigateur déverrouillé", () => {
    const cs = toFollowed(DEFAULT_TEAMS[1]);
    const roster = [{ id: "apEX", page: "ApEX" }, { id: "ZywOo" }];
    const snap = { ...emptySnapshot(), teams: { [cs.id]: { id: cs.id, name: cs.page, upcoming: [], recent: [], roster, fetchedAt: "x" } } } as never as Parameters<typeof stalePhotos>[0];
    const now = Date.parse("2026-11-08T12:00:00Z");
    snap.photos = { [photoKey("counterstrike", "ApEX")]: { src: "x.jpg", fetchedAt: "2026-11-01T12:00:00Z" } };
    expect(stalePhotos(snap, [cs], now).get("counterstrike")).toEqual(["ZywOo"]);
    expect(stalePhotos(snap, [cs], now + 14 * 86_400_000).get("counterstrike")).toEqual(["ApEX", "ZywOo"]);
    expect(rosterPhotos(snap, "counterstrike", roster, true)).toEqual({ apEX: { src: "x.jpg", fetchedAt: "2026-11-01T12:00:00Z" } });
    expect(rosterPhotos(snap, "counterstrike", roster, false)).toEqual({});
  });
});
