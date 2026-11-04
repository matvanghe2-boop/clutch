/**
 * Les équipes suivies, réglables depuis le site (/reglages). Stockées dans
 * Vercel Blob (config.json, à côté de l'instantané) en production, dans
 * data/config.json en local ; à défaut, les valeurs de src/config/follow.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { DEFAULT_TEAMS, GAME_IDS, type TeamConfig, WATCH_PRESETS } from "../../config/follow";
import { siblingUrl } from "./publish";

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
        (t.watch === undefined || t.watch in WATCH_PRESETS),
    )
  );
}

/**
 * `fresh` : contourner le CDN de Blob (60 s de cache). Utile à la synchro et
 * aux réglages ; à chaque visite du site, la version en cache suffit.
 */
export async function loadTeamConfig(fresh = true): Promise<TeamConfig[]> {
  try {
    const url = siblingUrl("config.json");
    if (url) {
      const res = await fetch(fresh ? `${url}?t=${Date.now()}` : url, { cache: "no-store" });
      if (res.ok) {
        const list = await res.json();
        if (valid(list) && list.length) return list;
      }
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
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.SNAPSHOT_URL) {
    await put("config.json", JSON.stringify(list), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(list, null, 2));
}
