/**
 * Outils de la synchronisation planifiée (.github/workflows/sync.yml).
 *
 *   tsx scripts/ci.ts restore <fichier>   reprend l'instantané mis en cache par la passe
 *                                         précédente s'il est plus récent que celui du dépôt
 *   tsx scripts/ci.ts changed             affiche « changed » si le contenu diffère du
 *                                         dernier commit, « unchanged » sinon
 *
 * L'instantané n'est commité que si son contenu change : un commit déclenche un
 * déploiement Vercel, inutile quand seule l'heure de la dernière lecture a bougé.
 * Ces heures restent pourtant nécessaires pour espacer les lectures : elles
 * voyagent d'une passe à l'autre dans le cache d'Actions.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { SNAPSHOT_PATH } from "../src/lib/snapshot";
import type { Snapshot } from "../src/lib/types";

/** Champs qui changent à chaque lecture sans que les données changent. */
const VOLATILE = new Set(["fetchedAt", "updatedAt", "failures"]);

const stable = (s: Snapshot) => JSON.stringify(s, (k, v) => (VOLATILE.has(k) ? undefined : v));

function read(file: string): Snapshot | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

const [command, arg] = process.argv.slice(2);

if (command === "restore") {
  const cached = read(arg);
  const committed = read(SNAPSHOT_PATH);
  const newer = cached?.updatedAt && (!committed?.updatedAt || cached.updatedAt > committed.updatedAt);
  if (newer) fs.copyFileSync(arg, SNAPSHOT_PATH);
  console.log(newer ? `État repris du cache (${cached.updatedAt}).` : "État du dépôt conservé.");
} else if (command === "changed") {
  let committed: Snapshot | null = null;
  try {
    committed = JSON.parse(execSync("git show HEAD:data/snapshot.json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    // Pas encore d'instantané commité.
  }
  const current = read(SNAPSHOT_PATH);
  console.log(current && (!committed || stable(current) !== stable(committed)) ? "changed" : "unchanged");
} else {
  console.error("Usage : tsx scripts/ci.ts restore <fichier> | changed");
  process.exit(2);
}
