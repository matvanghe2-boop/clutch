/**
 * Fabrique le fond de la carte des LAN (src/config/world-dots.ts) : les terres du globe en
 * points, une grille de STEP degrés, projection équirectangulaire. Chaque ligne de points
 * contigus devient un seul trait de chemin SVG, que `stroke-dasharray: 0 1` découpe en points.
 * Données : Natural Earth via le paquet world-atlas (domaine public). À relancer seulement si
 * l'on change la grille : `npx tsx scripts/world-dots.ts`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

const STEP = 2.5;
const TOP = 78;
const BOTTOM = -56;

const topo = JSON.parse(readFileSync(join(process.cwd(), "node_modules/world-atlas/land-110m.json"), "utf8")) as Topology;
const land = feature(topo, topo.objects.land as GeometryCollection);

type Ring = [number, number][];
const polygons: Ring[][] = [];
for (const f of land.features) {
  const g = f.geometry;
  if (g.type === "Polygon") polygons.push(g.coordinates as Ring[]);
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) polygons.push(p as Ring[]);
}

/** Lancer de rayon : le point est-il dans l'anneau ? */
function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const onLand = (p: [number, number]) => polygons.some(([outer, ...holes]) => inRing(p, outer) && !holes.some((h) => inRing(p, h)));

const cols = Math.round(360 / STEP);
const rows = Math.round((TOP - BOTTOM) / STEP);
const parts: string[] = [];
let dots = 0;
for (let r = 0; r < rows; r++) {
  const lat = TOP - (r + 0.5) * STEP;
  let run = -1;
  for (let c = 0; c <= cols; c++) {
    const here = c < cols && onLand([-180 + (c + 0.5) * STEP, lat]);
    if (here) dots++;
    if (here && run < 0) run = c;
    if (!here && run >= 0) {
      // Un trait de longueur n porte n + 1 points (un tous les 1) : le léger surplus garde le dernier.
      parts.push(`M${run + 0.5} ${r + 0.5}h${c - 1 - run}.01`);
      run = -1;
    }
  }
}

const out = `// Généré par scripts/world-dots.ts (Natural Earth, domaine public) : ne pas modifier à la main.
/** Pas de la grille, en degrés, et latitudes couvertes (l'Antarctique est laissé de côté). */
export const WORLD = { step: ${STEP}, top: ${TOP}, bottom: ${BOTTOM}, cols: ${cols}, rows: ${rows} } as const;
/** ${dots} points de terre, en traits horizontaux à découper en points. */
export const WORLD_DOTS = ${JSON.stringify(parts.join(""))};
`;
writeFileSync(join(process.cwd(), "src/config/world-dots.ts"), out);
console.log(`${dots} points, ${parts.length} traits, ${out.length} octets`);
