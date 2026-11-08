/**
 * Génère les icônes de l'appli à partir d'un seul dessin (src/lib/brand-mark.ts).
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
import { markSvg } from "../src/lib/brand-mark";

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
