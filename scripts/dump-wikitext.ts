/**
 * Enregistre le wikitexte d'une page (via l'API, au rythme permis) pour mettre
 * au point un parseur. Usage : tsx scripts/dump-wikitext.ts <wiki> "<page>"
 */
import fs from "node:fs";
import path from "node:path";
import { queryWikitext } from "../src/lib/liquipedia/client";
import type { GameId } from "../src/lib/types";

const [wiki, page] = process.argv.slice(2) as [GameId, string];
const dir = path.join(process.cwd(), "data", "raw");
fs.mkdirSync(dir, { recursive: true });
queryWikitext(wiki, page, (ms) => console.log(`attente ${Math.ceil(ms / 1000)} s`))
  .then((text) => {
    const file = path.join(dir, `${wiki}--${page.replace(/[\/:*?"<>|]/g, "_")}.wiki`);
    fs.writeFileSync(file, text);
    console.log(file, text.length);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
