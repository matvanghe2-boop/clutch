/**
 * Stockage des pronostics : predictions.json dans Blob, à côté de
 * l'instantané (data/predictions.json en local). Comme pour les équipes, le
 * CDN sert encore l'ancienne version une minute ou deux après une écriture :
 * les pronostics des dix dernières minutes sont aussi gardés dans un cookie,
 * pour les afficher tout de suite et ne pas les perdre à l'écriture suivante.
 */
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import type { Prediction, Predictions } from "./predictions";
import { CDN_MAX_AGE, siblingUrl } from "./sync/publish";

const LOCAL_PATH = path.join(process.cwd(), "data", "predictions.json");
const RECENT_COOKIE = "clutch_pronos";
const RECENT_MS = 10 * 60_000;

async function stored(): Promise<Predictions> {
  try {
    const url = siblingUrl("predictions.json");
    if (url) {
      const res = await fetch(url, { cache: "no-store" });
      return res.ok ? ((await res.json()) as Predictions) : {};
    }
    if (fs.existsSync(LOCAL_PATH)) return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")) as Predictions;
  } catch {
    // Fichier illisible : aucun pronostic plutôt qu'une page cassée.
  }
  return {};
}

async function recent(): Promise<Predictions> {
  try {
    const raw = (await cookies()).get(RECENT_COOKIE)?.value;
    return raw ? (JSON.parse(raw) as Predictions) : {};
  } catch {
    return {};
  }
}

export async function loadPredictions(): Promise<Predictions> {
  const [all, fresh] = await Promise.all([stored(), recent()]);
  return { ...all, ...fresh };
}

export async function savePrediction(id: string, p: Prediction): Promise<void> {
  const all = { ...(await loadPredictions()), [id]: p };
  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.SNAPSHOT_URL) {
    await put("predictions.json", JSON.stringify(all), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: CDN_MAX_AGE,
    });
  } else {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(all, null, 2));
  }
  const now = Date.now();
  const keep = Object.fromEntries(Object.entries({ ...(await recent()), [id]: p }).filter(([, v]) => now - Date.parse(v.at) < RECENT_MS));
  (await cookies()).set(RECENT_COOKIE, JSON.stringify(keep), {
    maxAge: RECENT_MS / 1000,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
