import fs from "node:fs";
import path from "node:path";
import type { GameId, Snapshot } from "./types";

/**
 * L'instantané est le seul lien entre la synchronisation (scripts/refresh.ts)
 * et le site : le site ne fait que le lire, jamais d'appel à Liquipedia.
 */
export const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshot.json");

export function emptySnapshot(): Snapshot {
  return { version: 1, updatedAt: null, teams: {}, tournaments: {}, failures: {} };
}

export function readSnapshot(): Snapshot {
  try {
    const s = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
    return { ...emptySnapshot(), ...s };
  } catch {
    return emptySnapshot();
  }
}

/** Écriture atomique : le site ne lit jamais un fichier à moitié écrit. */
export function writeSnapshot(s: Snapshot) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  const tmp = `${SNAPSHOT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, SNAPSHOT_PATH);
}

export function tournamentKey(wiki: GameId, page: string): string {
  return `${wiki}:${page}`;
}
