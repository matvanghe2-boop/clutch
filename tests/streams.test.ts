import { describe, expect, it } from "vitest";
import { embeddable } from "@/lib/streams";

describe("streams intégrables", () => {
  const streams = [
    { platform: "twitch", channel: "BLAST_Premier", url: "https://www.twitch.tv/BLAST_Premier" },
    { platform: "kick", channel: "pgl", url: "https://kick.com/pgl" },
    { platform: "youtube", channel: "BLASTPremier", url: "https://liquipedia.net/counterstrike/Special:Stream/youtube/BLASTPremier" },
  ];

  it("Twitch avec le nom du site hôte, sans le port ; Kick tel quel ; YouTube écarté", () => {
    expect(embeddable(streams, "localhost:3240")).toEqual([
      { label: "Twitch · BLAST_Premier", src: "https://player.twitch.tv/?channel=BLAST_Premier&parent=localhost&autoplay=true", url: streams[0].url },
      { label: "Kick · pgl", src: "https://player.kick.com/pgl", url: streams[1].url },
    ]);
  });

  it("en production, le domaine du site", () => {
    expect(embeddable(streams.slice(0, 1), "clutch-ochre.vercel.app")[0].src).toContain("parent=clutch-ochre.vercel.app");
  });
});
