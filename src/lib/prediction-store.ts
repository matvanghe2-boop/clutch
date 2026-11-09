/**
 * Stockage des pronostics : en ligne en production (voir `store`),
 * data/predictions.json en local. Sans base de données, comme pour les équipes, le
 * CDN de Blob sert encore l'ancienne version une minute ou deux après une écriture :
 * les pronostics des dix dernières minutes sont aussi gardés dans un cookie,
 * pour les afficher tout de suite et ne pas les perdre à l'écriture suivante.
 */
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { dedupePredictions, type Prediction, type Predictions } from "./predictions";
import { hasOnlineStore, readDoc, writeDoc } from "./store";

const LOCAL_PATH = path.join(process.cwd(), "data", "predictions.json");
const RECENT_COOKIE = "clutch_pronos";
const RECENT_MS = 10 * 60_000;

async function stored(): Promise<Predictions> {
  try {
    if (hasOnlineStore()) return (await readDoc<Predictions>("predictions")) ?? {};
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

/** Un seul pronostic par match, même s'il a été donné sous deux identifiants (voir `samePick`). */
export async function loadPredictions(): Promise<Predictions> {
  const [all, fresh] = await Promise.all([stored(), recent()]);
  return dedupePredictions({ ...all, ...fresh });
}

export async function savePrediction(id: string, p: Prediction): Promise<void> {
  // Lecture stricte : en cas de panne de la base, réécrire la sauvegarde d'hier perdrait les pronostics du jour.
  const current = hasOnlineStore() ? ((await readDoc<Predictions>("predictions", { strict: true })) ?? {}) : await stored();
  // Le nouveau pronostic remplace un éventuel ancien sur le même match, rangé sous un autre identifiant.
  const all = dedupePredictions({ ...current, ...(await recent()), [id]: p });
  if (!(await writeDoc("predictions", all))) {
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
