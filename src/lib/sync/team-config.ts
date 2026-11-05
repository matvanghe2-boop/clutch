/**
 * Les équipes suivies, réglables depuis le site (/reglages). Stockées dans
 * Vercel Blob (config.json, à côté de l'instantané) en production, dans
 * data/config.json en local ; à défaut, les valeurs de src/config/follow.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { DEFAULT_TEAMS, GAME_IDS, type TeamConfig, TWITCH_LOGIN, WATCH_PRESETS } from "../../config/follow";
import { CDN_MAX_AGE, siblingUrl } from "./publish";

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
 * Lue à travers le CDN de Blob : après une modification, l'ancienne version
 * peut encore être servie une minute ou deux (un paramètre d'URL n'y change
 * rien, le CDN l'ignore). La page Réglages s'en accommode avec un cookie.
 */
export async function loadTeamConfig(): Promise<TeamConfig[]> {
  try {
    const url = siblingUrl("config.json");
    if (url) {
      const res = await fetch(url, { cache: "no-store" });
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
      cacheControlMaxAge: CDN_MAX_AGE,
    });
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(list, null, 2));
}
