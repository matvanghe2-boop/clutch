/**
 * Synchronisation avec Liquipedia (la logique vit dans src/lib/sync/engine.ts).
 *
 *   npm run sync                  une passe : tout ce qui est périmé, puis s'arrête
 *   npm run sync:watch            tourne en continu (lancé aussi par npm run dev)
 *   npm run sync -- --force       relit tout une fois, même ce qui est à jour
 */
import { readSnapshot, writeSnapshot } from "../src/lib/snapshot";
import { runPass } from "../src/lib/sync/engine";
import { loadTeamConfig } from "../src/lib/sync/team-config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Pas de .env.local : le contact par défaut du User-Agent s'applique.
}

const watch = process.argv.includes("--watch");
const force = process.argv.includes("--force");
const MIN = 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toLocaleTimeString("fr-FR"), ...args);

async function main() {
  log(watch ? "Synchronisation continue démarrée." : "Synchronisation : une passe.");
  for (let first = true; ; first = false) {
    const snap = readSnapshot();
    const result = await runPass(snap, {
      profile: "local",
      teams: await loadTeamConfig(),
      force: force && first,
      log,
      afterTask: writeSnapshot,
    });
    if (result.refused) {
      if (!watch) throw new Error("Liquipedia refuse les requêtes (403 ou 429).");
      log("Liquipedia refuse les requêtes : pause de 30 minutes.");
      await sleep(30 * MIN);
      continue;
    }
    if (!watch) {
      log(result.remaining ? `${result.remaining} tâches restent pour la prochaine passe.` : "Tout est à jour.");
      return;
    }
    await sleep(MIN);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
