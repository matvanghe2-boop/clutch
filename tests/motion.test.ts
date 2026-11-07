import { describe, expect, it } from "vitest";
import { logoFile, resizedLogo } from "@/lib/logo-url";
import { stageOf } from "@/lib/motion/stage";
import { largeLogo, teamColors } from "@/lib/team-colors";

const THUMB = "https://liquipedia.net/commons/images/thumb/9/96/Team_Vitality_2023_darkmode.png/82px-Team_Vitality_2023_darkmode.png";

describe("logos", () => {
  it("reconnaît un logo quelle que soit la taille de sa vignette", () => {
    expect(logoFile(THUMB)).toBe("Team_Vitality_2023_darkmode.png");
    expect(logoFile(resizedLogo(THUMB, 320))).toBe("Team_Vitality_2023_darkmode.png");
  });

  it("demande la largeur voulue, et laisse tranquille une image sans vignette", () => {
    expect(resizedLogo(THUMB, 320)).toContain("/320px-Team_Vitality_2023_darkmode.png");
    const plain = "https://liquipedia.net/commons/images/9/96/Team_Vitality.png";
    expect(resizedLogo(plain, 320)).toBe(plain);
  });

  it("ne demande jamais une grande version qu'on ne sait pas exister", () => {
    const unknown = "https://liquipedia.net/commons/images/thumb/0/00/Inconnue.png/80px-Inconnue.png";
    expect(largeLogo({ name: "Inconnue", logo: unknown })).toBe(unknown);
  });
});

describe("couleurs d'équipe", () => {
  it("les clubs suivis gardent leurs couleurs, même au logo argenté", () => {
    expect(teamColors({ name: "Gentle Mates" })?.a).toBe("#ff6fc4");
    expect(teamColors({ name: "Vitality", page: "Team Vitality" })?.a).toBe("#ffe233");
  });

  it("une équipe inconnue n'a pas de couleur : le site garde celle du jeu", () => {
    expect(teamColors({ name: "Personne" })).toBeUndefined();
    expect(teamColors(null)).toBeUndefined();
  });
});

describe("paliers du compte à rebours", () => {
  it.each([
    [7200, "calm"],
    [3601, "calm"],
    [3600, "hour"],
    [61, "hour"],
    [60, "final"],
    [1, "final"],
    [0, "go"],
  ])("%i s : %s", (seconds, stage) => {
    expect(stageOf(seconds)).toBe(stage);
  });
});
