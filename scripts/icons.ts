/**
 * Génère les icônes de l'appli à partir d'un seul dessin (src/lib/brand-mark.ts).
 * Usage : npx tsx scripts/icons.ts  (sharp est fourni avec Next)
 *
 *   src/app/icon.svg               favicon, coins arrondis
 *   src/app/apple-icon.png         180 px, plein cadre (iOS arrondit lui-même)
 *   public/icons/icon-{192,512}.png   icônes du manifeste
 *   public/icons/maskable-512.png  plein cadre, dessin réduit à la zone sûre :
 *                                  Android y découpe un cercle ou une goutte
 *   public/icons/raccourci-*.png   les raccourcis de l'icône (appui long) : Ce soir,
 *                                  Calendrier, et un par jeu pour les équipes
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { markSvg } from "../src/lib/brand-mark";

/** Un pictogramme blanc sur le fond du logo, pour les raccourcis. */
const glyph = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141c2e"/><stop offset="1" stop-color="#07090d"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g transform="translate(256 256) scale(11) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>`;

const SHORTCUTS: Record<string, string> = {
  "raccourci-ce-soir": glyph(`<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>`),
  "raccourci-calendrier": glyph(`<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`),
  "raccourci-rocketleague": markSvg({ rounded: true, tint: "#4c8dff", id: "rl" }),
  "raccourci-counterstrike": markSvg({ rounded: true, tint: "#f4a62a", id: "cs" }),
  "raccourci-callofduty": markSvg({ rounded: true, tint: "#9be15d", id: "cod" }),
};

async function png(source: string, size: number, out: string) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toFile(out);
  console.log(out);
}

async function main() {
  const rounded = markSvg({ rounded: true });
  const full = markSvg();
  const maskable = markSvg({ safeZone: true });

  fs.writeFileSync("src/app/icon.svg", rounded);
  console.log("src/app/icon.svg");
  await png(full, 180, "src/app/apple-icon.png");
  await png(rounded, 192, "public/icons/icon-192.png");
  await png(rounded, 512, "public/icons/icon-512.png");
  await png(maskable, 512, "public/icons/maskable-512.png");
  for (const [name, source] of Object.entries(SHORTCUTS)) await png(source, 96, `public/icons/${name}.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
