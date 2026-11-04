/**
 * Outils de la synchronisation planifiée (.github/workflows/sync.yml).
 *
 *   tsx scripts/ci.ts restore <fichier>   repart de l'état le plus récent : celui mis en
 *                                         cache par la passe précédente, ou la version publiée
 *   tsx scripts/ci.ts publish             publie l'instantané dans Vercel Blob s'il diffère
 *                                         (--force : publie même sans changement)
 *                                         de la version en ligne
 *
 * Le site lit l'instantané dans Blob : publier ne crée ni commit ni
 * redéploiement. On ne publie pourtant que si les données ont changé, car le
 * plan Hobby limite les écritures dans Blob à 2 000 par mois. Les heures de
 * lecture de chaque page, elles, changent à chaque passe et servent à espacer
 * les appels à Liquipedia : elles voyagent dans le cache d'Actions.
 */
import fs from "node:fs";
import { put } from "@vercel/blob";
import { SNAPSHOT_PATH } from "../src/lib/snapshot";
import type { Snapshot } from "../src/lib/types";

/** Champs qui changent à chaque lecture sans que les données changent. */
const VOLATILE = new Set(["fetchedAt", "updatedAt", "failures"]);

const stable = (s: Snapshot) => JSON.stringify(s, (k, v) => (VOLATILE.has(k) ? undefined : v));

function readFile(file: string): Snapshot | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

async function readPublished(): Promise<Snapshot | null> {
  const url = process.env.SNAPSHOT_URL;
  if (!url) {
    // Toute première publication : l'adresse n'existe pas encore, c'est put() qui la donnera.
    console.log("SNAPSHOT_URL absent : pas de version publiée à comparer.");
    return null;
  }
  // Le paramètre contourne le CDN de Blob, qui garde le fichier 60 s.
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture de la version publiée : HTTP ${res.status}`);
  return (await res.json()) as Snapshot;
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (command === "restore") {
    const candidates = [
      { from: "cache", snap: readFile(arg) },
      { from: "version publiée", snap: await readPublished() },
    ].filter((c): c is { from: string; snap: Snapshot } => Boolean(c.snap?.updatedAt));
    const best = candidates.sort((a, b) => b.snap.updatedAt!.localeCompare(a.snap.updatedAt!))[0];
    if (!best) {
      console.log("Aucun état antérieur : première passe complète.");
      return;
    }
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(best.snap));
    console.log(`État repris de la ${best.from === "cache" ? "passe précédente (cache)" : best.from} : ${best.snap.updatedAt}.`);
    return;
  }

  if (command === "publish") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      // Avertissement visible dans le résumé de la passe, sans faire échouer
      // chaque passe (et envoyer un e-mail toutes les 15 min) tant que le
      // secret n'est pas posé.
      console.log("::warning::Secret BLOB_READ_WRITE_TOKEN absent : instantané non publié.");
      return;
    }
    const current = readFile(SNAPSHOT_PATH);
    if (!current) throw new Error("Aucun instantané à publier");
    const published = await readPublished();
    if (published && stable(published) === stable(current) && !process.argv.includes("--force")) {
      console.log("Données inchangées : rien à publier.");
      return;
    }
    const blob = await put("snapshot.json", JSON.stringify(current), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    console.log(`Publié : ${blob.url}`);
    return;
  }

  console.error("Usage : tsx scripts/ci.ts restore <fichier> | publish");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
