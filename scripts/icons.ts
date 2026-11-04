/**
 * Génère les icônes de l'appli à partir d'un seul dessin.
 * Usage : npx tsx scripts/icons.ts  (sharp est fourni avec Next)
 *
 *   src/app/icon.svg               favicon, coins arrondis
 *   src/app/apple-icon.png         180 px, plein cadre (iOS arrondit lui-même)
 *   public/icons/icon-{192,512}.png   icônes du manifeste
 *   public/icons/maskable-512.png  plein cadre, dessin réduit à la zone sûre :
 *                                  Android y découpe un cercle ou une goutte
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BG = "#0a0c10";
const INK = "#e9ecf2";
const GAMES = ["#4c8dff", "#f4a62a", "#9be15d"];

/**
 * Un « C » épais ouvert à droite, trois traits aux couleurs des jeux dans
 * l'ouverture. Le dessin occupe x = 104…380 : décalé de 14 px pour être centré.
 */
const mark = `<g transform="translate(14 0)">
  <path d="M 340.9 171.1 A 120 120 0 1 0 340.9 340.9" fill="none" stroke="${INK}" stroke-width="64" stroke-linecap="round"/>
  ${GAMES.map((c, i) => `<rect x="296" y="${213 + i * 34}" width="84" height="18" rx="9" fill="${c}"/>`).join("\n  ")}
  </g>`;

const svg = ({ rounded, safeZone }: { rounded: boolean; safeZone: boolean }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="${BG}"/>
  <g ${safeZone ? 'transform="translate(256 256) scale(0.78) translate(-256 -256)"' : ""}>${mark}
  </g>
</svg>
`;

async function png(source: string, size: number, out: string) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(out);
  console.log(out);
}

async function main() {
  const rounded = svg({ rounded: true, safeZone: false });
  const full = svg({ rounded: false, safeZone: false });
  const maskable = svg({ rounded: false, safeZone: true });

  fs.writeFileSync("src/app/icon.svg", rounded);
  console.log("src/app/icon.svg");
  await png(full, 180, "src/app/apple-icon.png");
  await png(rounded, 192, "public/icons/icon-192.png");
  await png(rounded, 512, "public/icons/icon-512.png");
  await png(maskable, 512, "public/icons/maskable-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
