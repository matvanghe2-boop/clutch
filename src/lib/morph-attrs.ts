import { largeLogo, teamColors } from "./team-colors";
import type { TeamRef } from "./types";

type Attrs = Record<`data-${string}`, string>;

/** Ce qu'une carte de match dit à l'intro (src/lib/motion/intro.ts) : ses couleurs, ses grands logos, ses noms. */
export function matchMorph(us: TeamRef | null, them: TeamRef | null): Attrs {
  const a = teamColors(us);
  const b = teamColors(them);
  return {
    "data-morph": "match",
    "data-colors": `${a?.a ?? ""},${b?.a ?? ""}`,
    "data-names": `${us?.name ?? ""}|${them?.name ?? ""}`,
    "data-logos": `${largeLogo(us) ?? ""}|${largeLogo(them) ?? ""}`,
  };
}

export function teamMorph(team: Pick<TeamRef, "name" | "page" | "logo"> | null): Attrs {
  const c = teamColors(team);
  return { "data-morph": "team", "data-colors": `${c?.a ?? ""},`, "data-logos": `${largeLogo(team) ?? ""}|` };
}

export function competitionMorph(color?: string): Attrs {
  return { "data-morph": "competition", "data-colors": `${color ?? ""},` };
}
