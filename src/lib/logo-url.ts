/** Largeur demandée pour les grands logos (scènes de match, en-têtes d'équipe, intros). */
export const HI_RES = 320;

/** Le nom du fichier d'un logo Liquipedia, indépendant de la taille de la vignette. */
export function logoFile(url: string): string {
  const name = url.split("/").pop() ?? url;
  return decodeURIComponent(name.replace(/^\d+px-/, ""));
}

/** La même vignette à une autre largeur. Une image sans vignette reste telle quelle. */
export function resizedLogo(url: string, width: number): string {
  return /\/thumb\//.test(url) ? url.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`) : url;
}
