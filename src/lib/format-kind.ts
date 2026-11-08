/**
 * Le format d'une phase de compétition, déduit de ce que la page Liquipedia en montre : poules,
 * ronde suisse, brackets à élimination simple ou double. Sert au schéma animé en tête de la page
 * de la compétition (components/FormatStrip.tsx).
 */
import type { BracketNode, Stage } from "./types";

export type FormatKind = "swiss" | "league" | "groups" | "single" | "double" | "gsl" | "list";

export interface StageFormat {
  kind: FormatKind;
  /** « Ronde suisse », « Double élimination »… */
  label: string;
  /** « 16 équipes · même bilan contre même bilan ». */
  detail?: string;
  /** Le titre de la phase sur Liquipedia (« Group Stage »), traduit quand on le connaît. */
  stage: string;
}

const STAGE_NAMES: Record<string, string> = {
  "group stage": "Phase de groupes",
  playoffs: "Phase finale",
  "league play": "Saison régulière",
  "regular season": "Saison régulière",
  "swiss stage": "Phase suisse",
  "main event": "Tableau final",
  results: "Tableau",
  "opening stage": "Phase d'ouverture",
  "elimination stage": "Phase éliminatoire",
};

/** Équipes au premier tour, d'après son nom. */
const ROUND_TEAMS: [RegExp, number][] = [
  [/round of (\d+)/i, 0],
  [/quarter/i, 8],
  [/semi/i, 4],
  [/grand final|^final/i, 2],
];

function teamsFromHeader(header?: string): number | undefined {
  if (!header) return undefined;
  for (const [re, n] of ROUND_TEAMS) {
    const m = re.exec(header);
    if (m) return n || Number(m[1]);
  }
  return undefined;
}

const leaves = (node: BracketNode): number => (node.children.length ? node.children.reduce((n, c) => n + leaves(c), 0) : 1);

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function stageFormat(stage: Stage, infoFormat = ""): StageFormat {
  const name = STAGE_NAMES[stage.title.trim().toLowerCase()] ?? stage.title;
  const groups = stage.blocks.flatMap((b) => (b.kind === "group" ? [b.table] : []));
  const brackets = stage.blocks.flatMap((b) => (b.kind === "bracket" ? [b.bracket] : []));
  const lists = stage.blocks.filter((b) => b.kind === "matchlist").length;

  if (groups.some((t) => t.rows.some((r) => r.rounds?.length))) {
    const teams = Math.max(...groups.map((t) => t.rows.length));
    return { kind: "swiss", label: "Ronde suisse", detail: `${plural(teams, "équipe")} · même bilan contre même bilan`, stage: name };
  }
  if (brackets.length > 1) {
    const double = brackets.every((b) => b.sections.length > 1);
    return {
      kind: double ? "gsl" : "single",
      label: double ? "Groupes à double élimination" : "Brackets",
      detail: `${brackets.length} groupes${double ? " · deux défaites pour sortir" : ""}`,
      stage: name,
    };
  }
  if (brackets.length === 1) {
    const [b] = brackets;
    const first = b.sections[0];
    const teams = teamsFromHeader(first?.headers[0]) ?? (first ? first.roots.reduce((n, r) => n + leaves(r), 0) * 2 : undefined);
    const double = b.sections.length > 1;
    return {
      kind: double ? "double" : "single",
      label: double ? "Double élimination" : "Élimination directe",
      detail: [teams ? plural(teams, "équipe") : null, double ? "une deuxième chance par le bas" : "une défaite et c'est fini"].filter(Boolean).join(" · "),
      stage: name,
    };
  }
  if (groups.length > 1) {
    const size = Math.max(...groups.map((t) => t.rows.length));
    return { kind: "groups", label: "Poules", detail: `${groups.length} poules de ${size}`, stage: name };
  }
  if (groups.length === 1) {
    const twice = /double round robin/i.test(infoFormat);
    return { kind: "league", label: twice ? "Championnat aller-retour" : "Championnat", detail: `${plural(groups[0].rows.length, "équipe")} · chacun contre tous`, stage: name };
  }
  return { kind: "list", label: "Matchs", detail: lists ? plural(lists, "série") : undefined, stage: name };
}
