import { largeLogo, teamColors } from "./team-colors";
import type { Match, TeamRef } from "./types";

type Attrs = Record<`data-${string}`, string>;

/**
 * Ce qu'une carte de match dit à la transition de page (src/lib/motion/nav.ts) : ses couleurs,
 * ses grands logos, et si l'intro de match a du sens. Seulement pour un match à venir ou en
 * cours, et contre un adversaire connu : revoir des résultats passés doit rester instantané.
 */
export function matchMorph(m: Pick<Match, "id">, us: TeamRef | null, them: TeamRef | null, status: string): Attrs {
  const a = teamColors(us);
  const b = teamColors(them);
  const coming = status === "upcoming" || status === "live";
  return {
    "data-morph": "match",
    "data-colors": `${a?.a ?? ""},${b?.a ?? ""}`,
    "data-names": `${us?.name ?? ""}|${them?.name ?? ""}`,
    "data-logos": `${largeLogo(us) ?? ""}|${largeLogo(them) ?? ""}`,
    ...(coming && us && them ? { "data-intro": m.id } : {}),
  };
}

export function teamMorph(team: Pick<TeamRef, "name" | "page" | "logo"> | null): Attrs {
  const c = teamColors(team);
  return { "data-morph": "team", "data-colors": `${c?.a ?? ""},`, "data-logos": `${largeLogo(team) ?? ""}|` };
}

export function competitionMorph(color?: string): Attrs {
  return { "data-morph": "competition", "data-colors": `${color ?? ""},` };
}
