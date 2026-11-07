/**
 * Relève les couleurs de chaque logo connu, et si Liquipedia en a une version plus grande.
 * Les images ne se lisent pas depuis le navigateur (pas d'en-tête CORS) : le résultat est écrit
 * dans src/config/team-colors.json et versionné. Un nouveau logo non relevé garde la couleur du
 * jeu ; relancer le script de temps en temps suffit.
 *
 * Usage : npx tsx scripts/team-colors.ts  (sharp est fourni avec Next)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { HI_RES, logoFile, resizedLogo } from "../src/lib/logo-url";

const OUT = path.join(process.cwd(), "src/config/team-colors.json");
/** Une image à la fois, sans presser le serveur de Liquipedia. */
const GAP_MS = 350;
const UA = "Clutch/1.0 (https://github.com/matvanghe2-boop/clutch)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// sRGB vers OKLCH, puis retour : la seule échelle où « aussi clair » veut dire la même chose pour toutes les teintes.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklch(r8: number, g8: number, b8: number) {
  const [r, g, b] = [toLinear(r8 / 255), toLinear(g8 / 255), toLinear(b8 / 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function hexOf(L: number, C: number, H: number): string {
  // On réduit la saturation jusqu'à ce que la couleur existe en sRGB.
  for (let c = C; c >= 0; c -= 0.005) {
    const a = c * Math.cos((H * Math.PI) / 180);
    const b = c * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005))
      return `#${rgb
        .map((v) =>
          Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
  }
  return "#c8d0dc";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Les deux couleurs d'un logo, rendues lisibles sur le fond sombre du site. */
async function colorsOf(buffer: Buffer): Promise<[string, string] | null> {
  const { data, info } = await sharp(buffer).ensureAlpha().resize(96, 96, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, hue: 0, chroma: 0, light: 0, n: 0 }));
  let opaque = 0;
  let chromatic = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const { L, C, H } = oklch(data[i], data[i + 1], data[i + 2]);
    if (C < 0.045 || L < 0.2) continue;
    chromatic++;
    const b = buckets[Math.floor(H / 15) % 24];
    const w = C ** 1.3;
    b.weight += w;
    b.hue += H * w;
    b.chroma += C * w;
    b.light += L * w;
    b.n += w;
  }
  // Logo noir et blanc : pas de couleur à lui prêter, le site retombe sur celle du jeu.
  if (!opaque || chromatic / opaque < 0.05) return null;
  const ranked = buckets
    .filter((b) => b.weight > 0)
    .map((b) => ({ weight: b.weight, H: b.hue / b.n, C: b.chroma / b.n, L: b.light / b.n }))
    .sort((a, b) => b.weight - a.weight);
  const first = ranked[0];
  const second = ranked.find((b) => hueGap(b.H, first.H) >= 35 && b.weight >= first.weight * 0.12);
  // La clarté d'origine, seulement bornée : un rouge reste rouge et un jaune reste jaune.
  const a = hexOf(clamp(first.L, 0.66, 0.9), clamp(first.C, 0.1, 0.26), first.H);
  const b = second ? hexOf(clamp(second.L, 0.58, 0.82), clamp(second.C, 0.08, 0.24), second.H) : hexOf(clamp(first.L - 0.16, 0.5, 0.74), clamp(first.C, 0.1, 0.22), (first.H + 18) % 360);
  return [a, b];
}

function logosOfSnapshot(): string[] {
  const snap = JSON.parse(readFileSync(path.join(process.cwd(), "data/snapshot.json"), "utf8"));
  const found = new Set<string>();
  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 14) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const logo = (node as { logo?: unknown }).logo;
    if (typeof logo === "string" && logo.startsWith("http")) found.add(logo);
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  walk(snap);
  return [...found];
}

async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

type Entry = { a?: string; b?: string; w: number };

async function main() {
  const table: Record<string, Entry> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const logos = logosOfSnapshot();
  const todo = logos.filter((url) => !table[logoFile(url)]);
  console.log(`${logos.length} logos, ${todo.length} à relever`);
  for (const url of todo) {
    const file = logoFile(url);
    try {
      // Liquipedia refuse une vignette plus large que l'image d'origine : on descend jusqu'à en trouver une.
      let image: Buffer | null = null;
      let width = 0;
      for (const w of [HI_RES, 240, 160]) {
        image = await fetchImage(resizedLogo(url, w));
        await sleep(GAP_MS);
        if (image) {
          width = w;
          break;
        }
      }
      image ??= await fetchImage(url);
      if (!image) {
        console.warn("illisible :", file);
        continue;
      }
      const colors = await colorsOf(image);
      table[file] = { ...(colors ? { a: colors[0], b: colors[1] } : {}), w: width };
      console.log(file, colors?.join(" ") ?? "(neutre)", width || "(petite image seulement)");
    } catch (e) {
      console.warn("échec :", file, (e as Error).message);
    }
    await sleep(GAP_MS);
  }
  const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 0).replace(/},/g, "},\n")}\n`);
  console.log(`écrit : ${Object.keys(sorted).length} logos`);
}

main();
