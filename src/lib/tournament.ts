import type { BracketNode, Match, Tournament } from "./types";

/** Tous les matchs d'une compétition, listes et brackets confondus. */
export function tournamentMatches(t: Tournament): Match[] {
  const out: Match[] = [];
  const walk = (n: BracketNode) => {
    if (n.match) out.push(n.match);
    n.children.forEach(walk);
  };
  for (const stage of t.stages)
    for (const b of stage.blocks) {
      if (b.kind === "matchlist") out.push(...b.list.matches);
      if (b.kind === "bracket") b.bracket.sections.forEach((sec) => sec.roots.forEach(walk));
    }
  return out;
}
