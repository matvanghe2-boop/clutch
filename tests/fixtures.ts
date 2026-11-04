/**
 * Pages Liquipedia capturées le 3-4 novembre 2026 (réponses de l'API, compressées).
 * Contenu sous licence CC BY-SA 3.0, © les contributeurs de Liquipedia.
 * Pour en ajouter : `npx tsx scripts/dump.ts <wiki> "<page>"`, puis gzip vers tests/fixtures.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { vi } from "vitest";

export const CAPTURED_AT = new Date("2026-11-04T12:00:00Z");

export function fixture(name: string): string {
  return zlib.gunzipSync(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.gz`))).toString("utf8");
}

/** Fige l'horloge au jour de la capture (dates sans année, matchs « à venir »). */
export function atCaptureDate() {
  vi.useFakeTimers({ now: CAPTURED_AT, toFake: ["Date"] });
}
