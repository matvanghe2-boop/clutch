/**
 * Placement des matchs d'un bracket en colonnes, partagé par le parseur (noms
 * des tours) et l'affichage (ligne d'en-têtes, colonnes vides).
 *
 * Un nœud est placé une colonne à gauche de son match parent, plus les
 * colonnes que Liquipedia lui fait sauter (`skip`, lu dans `--skip-round`) :
 * en double élimination, la finale du bracket gagnant saute la colonne où se
 * joue la finale du bracket perdant. Un sous-arbre plus court se range donc
 * contre son parent, comme sur Liquipedia.
 */
import type { BracketNode, BracketSection } from "./types";

/** Visite chaque nœud avec son rang compté depuis la racine (0), colonnes sautées comprises. */
function walk(n: BracketNode, r: number, visit: (n: BracketNode, r: number) => void) {
  visit(n, r);
  for (const c of n.children) walk(c, r + 1 + (c.skip ?? 0), visit);
}

export interface BracketLayout {
  /** Nombre de colonnes ; la racine occupe la dernière. */
  width: number;
  /** Largeur de chaque arbre, pour caler les plus courts à droite. */
  rootWidths: number[];
  /** Intitulé de chaque colonne de gauche à droite (null : colonne sautée). Absent si les en-têtes ne correspondent pas aux colonnes. */
  columns?: (string | null)[];
  /** En-tête d'une colonne finale sans match (« Qualified ») : on y montre le vainqueur de la racine. */
  trailing?: string;
}

export function bracketLayout({ headers, roots }: BracketSection): BracketLayout {
  const used = new Set<number>();
  const rootWidths = roots.map((root) => {
    let max = 0;
    walk(root, 0, (_, r) => {
      used.add(r);
      max = Math.max(max, r);
    });
    return max + 1;
  });
  const width = Math.max(0, ...rootWidths);
  // Un en-tête par colonne occupée, de gauche à droite ; un de plus pour une colonne « Qualified ».
  const ranks = [...used].sort((a, b) => b - a);
  if (!ranks.length || (headers.length !== ranks.length && headers.length !== ranks.length + 1)) return { width, rootWidths };
  const byRank = new Map(ranks.map((r, i) => [r, headers[i]]));
  return {
    width,
    rootWidths,
    columns: Array.from({ length: width }, (_, c) => byRank.get(width - 1 - c) ?? null),
    trailing: headers[ranks.length],
  };
}

/** Donne à chaque match le nom de sa colonne (« Upper Bracket Final »). */
export function labelRounds(section: BracketSection) {
  const { columns, width } = bracketLayout(section);
  if (!columns) return;
  for (const root of section.roots)
    walk(root, 0, (n, r) => {
      const name = columns[width - 1 - r];
      if (n.match && name) n.match.round = name;
    });
}
