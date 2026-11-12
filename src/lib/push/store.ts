/**
 * Les abonnements aux notifications et le journal de ce qui a déjà été envoyé. En ligne, dans la
 * base seulement (jamais dans Blob, qui est public) ; en local, dans data/ (ignoré par git).
 */
import fs from "node:fs";
import path from "node:path";
import { hasDatabase, readDoc, writeDoc } from "../store";

/** Ce qu'on veut recevoir. */
export interface PushPrefs {
  /** Un quart d'heure avant le début d'un match. */
  before: boolean;
  /** Chaque manche pendant le direct. */
  score: boolean;
  /** Le résultat final. */
  result: boolean;
  /** Une heure de match changée par Liquipedia. */
  schedule: boolean;
}

export const DEFAULT_PREFS: PushPrefs = { before: true, score: true, result: true, schedule: true };

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  prefs: PushPrefs;
  /** « iPhone », « Android »… pour s'y retrouver. */
  device?: string;
  at: string;
}

export type PushSubs = Record<string, PushSub>;

/** Ce qui a été envoyé, par événement : de quoi ne jamais envoyer deux fois la même chose. */
export type PushSent = Record<string, { at: string; value?: string }>;

const LOCAL = (name: string) => path.join(process.cwd(), "data", `${name}.json`);

async function read<T>(name: "push" | "push-sent"): Promise<T | null> {
  if (hasDatabase()) return readDoc<T>(name, { strict: true });
  try {
    return JSON.parse(fs.readFileSync(LOCAL(name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function write(name: "push" | "push-sent", value: unknown): Promise<void> {
  if (hasDatabase()) {
    await writeDoc(name, value);
    return;
  }
  // Sans base, jamais Blob (public) : un fichier local, et seulement hors de Vercel.
  if (process.env.VERCEL) throw new Error("Pas de base de données : les abonnements aux notifications ne peuvent pas être gardés.");
  fs.mkdirSync(path.dirname(LOCAL(name)), { recursive: true });
  fs.writeFileSync(LOCAL(name), JSON.stringify(value, null, 2));
}

/** L'identifiant d'un abonnement : la fin de son adresse, unique par appareil et navigateur. */
export const subId = (endpoint: string) => endpoint.slice(-48);

export const loadSubs = async () => (await read<PushSubs>("push")) ?? {};
export const saveSubs = (subs: PushSubs) => write("push", subs);
export const loadSent = async () => (await read<PushSent>("push-sent")) ?? {};
export const saveSent = (sent: PushSent) => write("push-sent", sent);
