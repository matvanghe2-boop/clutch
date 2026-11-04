/**
 * Enregistre le HTML d'une page (via l'API, au rythme permis) pour mettre au
 * point un parseur. Usage : tsx scripts/dump.ts <wiki> "<page>" [<wiki> "<page>"…]
 */
import fs from "node:fs";
import path from "node:path";
import { parsePage } from "../src/lib/liquipedia/client";
import type { GameId } from "../src/lib/types";

const args = process.argv.slice(2);
const dir = path.join(process.cwd(), "data", "raw");
fs.mkdirSync(dir, { recursive: true });
async function main() {
  for (let i = 0; i + 1 < args.length; i += 2) {
  const [wiki, page] = [args[i] as GameId, args[i + 1]];
  const r = await parsePage(wiki, page, (ms) => console.log(`attente ${Math.ceil(ms / 1000)} s`));
  const file = path.join(dir, `${wiki}--${page.replace(/[\/:*?"<>|]/g, "_")}.html`);
  fs.writeFileSync(file, r.html);
  console.log(file, r.html.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
