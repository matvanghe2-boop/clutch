/**
 * Le logo de Clutch, en un seul dessin pour l'icône de l'appli, le favicon et l'en-tête.
 *
 * Un C incliné comme les titres du site, tranché en biais par la coupure de la scène de match :
 * sa moitié droite est décalée, comme au moment d'un choc. La coupure porte les couleurs des trois
 * jeux, du bleu de Rocket League au vert de Call of Duty en passant par l'orange de CS2.
 */

const RL = "#4c8dff";
const CS = "#f4a62a";
const COD = "#9be15d";

/** Le C : un arc épais ouvert à droite, plus haut que large comme les lettres du site, centré une fois incliné. */
const ARC = "M 362.9 167.3 A 116 138 0 1 0 362.9 344.7";
/** L'inclinaison des titres (une dizaine de degrés), recentrée sur le milieu du carré. */
const ITALIC = "matrix(1 0 -0.176 1 45 0)";
/** La coupure : de (306, 0) à (216, 512), la même pente que l'italique. */
const LEFT = "0,0 306,0 216,512 0,512";
const RIGHT = "306,0 512,0 512,512 216,512";

/** `tint` : une seule couleur au lieu des trois jeux, pour l'icône d'un raccourci. */
export function markSvg({ rounded = false, safeZone = false, id = "clutch", tint }: { rounded?: boolean; safeZone?: boolean; id?: string; tint?: string } = {}): string {
  const [rl, cs, cod] = tint ? [tint, tint, tint] : [RL, CS, COD];
  const r = rounded ? ' rx="112"' : "";
  const letter = `<path d="${ARC}" fill="none" stroke="url(#${id}-ink)" stroke-width="80" transform="${ITALIC}"/>`;
  const drawing = `
  <g clip-path="url(#${id}-l)">${letter}</g>
  <g clip-path="url(#${id}-r)" class="mark-cut"><g transform="translate(16 -22)">${letter}</g></g>
  <polygon points="299,14 313,14 223,498 209,498" fill="url(#${id}-seam)" filter="url(#${id}-glow)" opacity="0.95" class="mark-seam"/>
  <polygon points="303,20 309,20 219,492 213,492" fill="url(#${id}-seam)"/>
  <polygon points="305,20 307,20 217,492 215,492" fill="#fff" opacity="0.85"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141c2e"/><stop offset="1" stop-color="#07090d"/></linearGradient>
    <radialGradient id="${id}-a" cx="0.14" cy="0.16" r="0.75"><stop offset="0" stop-color="${rl}" stop-opacity="0.5"/><stop offset="1" stop-color="${rl}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-b" cx="0.92" cy="0.94" r="0.7"><stop offset="0" stop-color="${cod}" stop-opacity="0.34"/><stop offset="1" stop-color="${cod}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-seam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rl}"/><stop offset="0.5" stop-color="${cs}"/><stop offset="1" stop-color="${cod}"/></linearGradient>
    <linearGradient id="${id}-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3cddd"/></linearGradient>
    <clipPath id="${id}-l"><polygon points="${LEFT}"/></clipPath>
    <clipPath id="${id}-r"><polygon points="${RIGHT}"/></clipPath>
    <filter id="${id}-glow" x="-200%" y="-10%" width="500%" height="120%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="512" height="512"${r} fill="url(#${id}-bg)"/>
  <rect width="512" height="512"${r} fill="url(#${id}-a)"/>
  <rect width="512" height="512"${r} fill="url(#${id}-b)"/>
  <g${safeZone ? ' transform="translate(256 256) scale(0.76) translate(-256 -256)"' : ""}>${drawing}
  </g>
</svg>
`;
}
