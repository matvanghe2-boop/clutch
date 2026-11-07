import table from "@/config/team-colors.json";
import { logoFile, resizedLogo } from "./logo-url";
import type { TeamRef } from "./types";

export interface TeamColors {
  a: string;
  b: string;
}

/**
 * Les couleurs des clubs suivis, posées à la main : un logo argenté ne dit pas la couleur d'un
 * club. Tous les autres viennent de leur logo (scripts/team-colors.ts).
 */
const OWN: Record<string, TeamColors> = {
  "Gentle Mates": { a: "#ff6fc4", b: "#9d6bff" },
  "Paris Gentle Mates": { a: "#ff6fc4", b: "#9d6bff" },
  "Team Vitality": { a: "#ffe233", b: "#f5a300" },
};

type Entry = { a?: string; b?: string; w?: number };
const LOGOS = table as Record<string, Entry>;

type Ref = Pick<TeamRef, "name" | "page" | "logo"> | null | undefined;

export function teamColors(team: Ref): TeamColors | undefined {
  if (!team) return undefined;
  const own = OWN[team.page ?? team.name] ?? OWN[team.name];
  if (own) return own;
  const entry = team.logo ? LOGOS[logoFile(team.logo)] : undefined;
  return entry?.a && entry.b ? { a: entry.a, b: entry.b } : undefined;
}

/** Une version nette du logo pour les grands formats, quand Liquipedia en a une. */
export function largeLogo(team: Ref): string | undefined {
  if (!team?.logo) return undefined;
  const width = LOGOS[logoFile(team.logo)]?.w;
  return width ? resizedLogo(team.logo, width) : team.logo;
}

/** Donne au conteneur la couleur de l'équipe : titres, barres et courbes la prennent d'eux-mêmes. */
export function accentOf(team: Ref): React.CSSProperties | undefined {
  const c = teamColors(team);
  return c ? ({ "--accent": c.a, "--accent-2": c.b } as React.CSSProperties) : undefined;
}

/** Les deux équipes d'une scène, et l'accent de celle qu'on suit. */
export function duelVars(us: Ref, them: Ref): React.CSSProperties {
  const a = teamColors(us);
  const b = teamColors(them);
  return {
    ...(a ? { "--accent": a.a, "--team-a": a.a, "--team-a2": a.b } : {}),
    ...(b ? { "--team-b": b.a, "--team-b2": b.b } : {}),
  } as React.CSSProperties;
}
