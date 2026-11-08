/** L'ordre des blocs de l'accueil, choisi dans « Réorganiser » (components/Arrange.tsx) et lu par le serveur. */
export const ORDER_COOKIE = "clutch_accueil";

export function parseOrder(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[~,]/)
    .map((s) => s.trim())
    .filter((s) => /^[a-z-]{1,20}$/.test(s))
    .slice(0, 12);
}
