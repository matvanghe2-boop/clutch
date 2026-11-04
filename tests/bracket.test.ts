import { describe, expect, it } from "vitest";
import { bracketLayout, labelRounds } from "@/lib/bracket";
import type { BracketNode, BracketSection, Match } from "@/lib/types";

/** Un match minimal, repérable par son nom. */
const match = (id: string): Match =>
  ({ id, opponents: [null, null], scores: [null, null], finished: false, games: [], streams: [] }) as unknown as Match;
const node = (id: string, children: BracketNode[] = [], skip?: number): BracketNode => ({ match: match(id), children, ...(skip ? { skip } : {}) });
const roundOf = (section: BracketSection, id: string): string | undefined => {
  const find = (n: BracketNode): Match | undefined => (n.match?.id === id ? n.match : n.children.map(find).find(Boolean));
  return section.roots.map(find).find(Boolean)?.round;
};

describe("bracketLayout / labelRounds", () => {
  it("arbre régulier : un en-tête par niveau", () => {
    const s: BracketSection = { headers: ["QF", "SF", "F"], roots: [node("f", [node("sf1", [node("qf1"), node("qf2")]), node("sf2", [node("qf3"), node("qf4")])])] };
    labelRounds(s);
    expect(bracketLayout(s)).toMatchObject({ width: 3, columns: ["QF", "SF", "F"] });
    expect(["f", "sf1", "qf4"].map((id) => roundOf(s, id))).toEqual(["F", "SF", "QF"]);
  });

  it("exempté : le sous-arbre court se range contre son parent", () => {
    const s: BracketSection = { headers: ["R1", "SF", "F"], roots: [node("f", [node("sf1", [node("r1")]), node("sf2")])] };
    labelRounds(s);
    expect(roundOf(s, "sf2")).toBe("SF");
    expect(roundOf(s, "r1")).toBe("R1");
  });

  it("colonne finale « Qualified » : en-tête de plus, sans nœud", () => {
    const s: BracketSection = { headers: ["SF", "F", "Qualified"], roots: [node("f", [node("sf1"), node("sf2")])] };
    labelRounds(s);
    expect(bracketLayout(s)).toMatchObject({ columns: ["SF", "F"], trailing: "Qualified" });
    expect(roundOf(s, "f")).toBe("F");
  });

  it("colonne sautée : l'en-tête suivant reste sur la bonne colonne", () => {
    const s: BracketSection = { headers: ["SF", "UBF", "GF"], roots: [node("gf", [node("ubf", [node("sf1"), node("sf2")], 1)])] };
    labelRounds(s);
    expect(bracketLayout(s).columns).toEqual(["SF", "UBF", null, "GF"]);
    expect(["gf", "ubf", "sf1"].map((id) => roundOf(s, id))).toEqual(["GF", "UBF", "SF"]);
  });

  it("plusieurs arbres de profondeurs différentes : les plus courts se calent à droite", () => {
    const s: BracketSection = { headers: ["R1", "R2"], roots: [node("a", [node("a1"), node("a2")]), node("b")] };
    labelRounds(s);
    expect(bracketLayout(s)).toMatchObject({ width: 2, rootWidths: [2, 1] });
    expect(roundOf(s, "b")).toBe("R2");
  });

  it("en-têtes sans rapport avec l'arbre : aucun nom inventé", () => {
    const s: BracketSection = { headers: ["A", "B", "C", "D", "E"], roots: [node("f", [node("sf")])] };
    labelRounds(s);
    expect(bracketLayout(s).columns).toBeUndefined();
    expect(roundOf(s, "f")).toBeUndefined();
  });
});
