/**
 * Les équipes suivies, réglables depuis le site (/reglages). Stockées en ligne
 * en production (voir `../store`), dans data/config.json en local ; à défaut, les
 * valeurs de src/config/follow.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TEAMS, GAME_IDS, type TeamConfig, TWITCH_LOGIN, WATCH_PRESETS } from "../../config/follow";
import { hasOnlineStore, readDoc, writeDoc } from "../store";

const LOCAL_PATH = path.join(process.cwd(), "data", "config.json");

function valid(list: unknown): list is TeamConfig[] {
  return (
    Array.isArray(list) &&
    list.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.page === "string" &&
        GAME_IDS.includes(t.game) &&
        (t.watch === undefined || t.watch in WATCH_PRESETS) &&
        (t.streams === undefined || (Array.isArray(t.streams) && t.streams.every((c: unknown) => typeof c === "string" && TWITCH_LOGIN.test(c)))),
    )
  );
}

/** Une liste d'équipes reçue sous forme de texte (cookie), si elle est valide. */
export function parseTeamConfig(raw: string | undefined): TeamConfig[] | null {
  try {
    const list = raw ? JSON.parse(raw) : null;
    return valid(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

/**
 * Sans base de données, lue à travers le CDN de Blob : après une modification,
 * l'ancienne version peut encore être servie une minute ou deux. La page Réglages
 * s'en accommode avec un cookie.
 */
export async function loadTeamConfig(): Promise<TeamConfig[]> {
  try {
    if (hasOnlineStore()) {
      const list = await readDoc<unknown>("config");
      if (valid(list) && list.length) return list;
    } else if (fs.existsSync(LOCAL_PATH)) {
      const list = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
      if (valid(list) && list.length) return list;
    }
  } catch {
    // Réglages illisibles : les valeurs par défaut s'appliquent.
  }
  return DEFAULT_TEAMS;
}

export async function saveTeamConfig(list: TeamConfig[]): Promise<void> {
  if (!valid(list)) throw new Error("Configuration d'équipes invalide");
  if (await writeDoc("config", list)) return;
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(list, null, 2));
}
