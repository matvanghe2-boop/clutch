"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GAME_IDS, GAMES, type TeamConfig, WATCH_PRESETS, type WatchPreset } from "@/config/follow";
import { ADMIN_COOKIE, currentTeams, isAdmin, pinDigest, rememberTeams } from "@/lib/admin";
import { HIDDEN_COOKIE, readHidden } from "@/lib/hidden";
import { pageExists } from "@/lib/liquipedia/client";
import { saveTeamConfig } from "@/lib/sync/team-config";
import type { GameId } from "@/lib/types";

const MAX_TEAMS = 8;

async function setHidden(update: (set: Set<string>) => void) {
  const set = await readHidden();
  update(set);
  (await cookies()).set(HIDDEN_COOKIE, JSON.stringify([...set]), {
    maxAge: 365 * 86400,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}

export async function hideCompetition(form: FormData) {
  const key = String(form.get("key") ?? "");
  if (key) await setHidden((s) => s.add(key));
}

export async function showCompetition(form: FormData) {
  const key = String(form.get("key") ?? "");
  if (key) await setHidden((s) => s.delete(key));
}

/**
 * Les équipes sont communes à tous les visiteurs : les modifier demande le code
 * défini dans la variable CLUTCH_ADMIN_PIN de Vercel (ou de .env.local). On le
 * saisit une fois (« Déverrouiller ») ; un cookie en garde l'empreinte 30 jours.
 */
async function checkPin(): Promise<string | null> {
  if (!process.env.CLUTCH_ADMIN_PIN) return "Aucun code défini : ajoute la variable CLUTCH_ADMIN_PIN dans Vercel (ou .env.local), puis redéploie.";
  return (await isAdmin()) ? null : "Déverrouille d'abord les réglages avec ton code.";
}

export async function unlock(form: FormData) {
  const expected = process.env.CLUTCH_ADMIN_PIN;
  if (!expected) back({ erreur: "Aucun code défini : ajoute la variable CLUTCH_ADMIN_PIN dans Vercel (ou .env.local), puis redéploie." });
  if (String(form.get("pin") ?? "") !== expected) {
    // Freine les essais en série.
    await new Promise((r) => setTimeout(r, 1500));
    back({ erreur: "Code incorrect." });
  }
  (await cookies()).set(ADMIN_COOKIE, pinDigest(expected!), {
    maxAge: 30 * 86400,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  back({ ok: "Réglages déverrouillés pour 30 jours sur ce navigateur." });
}

export async function lock() {
  (await cookies()).delete(ADMIN_COOKIE);
  back({ ok: "Réglages verrouillés." });
}

const back = (params: Record<string, string>): never => redirect(`/reglages?${new URLSearchParams(params)}`);

/** Enregistre la liste et la garde aussi dans un cookie, le temps que le CDN de Blob suive. */
async function store(list: TeamConfig[]) {
  await saveTeamConfig(list);
  await rememberTeams(list);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function addTeam(form: FormData) {
  const error = await checkPin();
  if (error) back({ erreur: error });
  const game = String(form.get("game")) as GameId;
  const title = String(form.get("page") ?? "").trim();
  const watch = String(form.get("watch") ?? "none") as WatchPreset;
  if (!GAME_IDS.includes(game) || !title) back({ erreur: "Choisis un jeu et le titre de la page Liquipedia de l'équipe." });
  if (!(watch in WATCH_PRESETS)) back({ erreur: "Règle de surveillance inconnue." });

  const teams = await currentTeams();
  if (teams.length >= MAX_TEAMS) back({ erreur: `${MAX_TEAMS} équipes au plus : la synchro doit rester dans le rythme imposé par Liquipedia.` });
  // Le titre exact (redirections suivies) : « vitality » → « Team Vitality ».
  const page = await pageExists(game, title).catch(() => undefined);
  if (!page) back({ erreur: `Aucune page « ${title} » sur le wiki ${GAMES[game].label} de Liquipedia.` });
  if (teams.some((t) => t.game === game && t.page === page)) back({ erreur: `${page} est déjà suivie.` });

  let id = slug(`${page}-${GAMES[game].short}`);
  while (teams.some((t) => t.id === id)) id += "-2";
  const next: TeamConfig[] = [...teams, { id, game, page: page!, watch }];
  await store(next);
  back({ ok: `${page} ajoutée. Ses matchs arrivent à la prochaine synchro, dans quelques minutes.` });
}

export async function removeTeam(form: FormData) {
  const error = await checkPin();
  if (error) back({ erreur: error });
  const id = String(form.get("id") ?? "");
  const teams = await currentTeams();
  const next = teams.filter((t) => t.id !== id);
  if (!next.length) back({ erreur: "Il faut garder au moins une équipe." });
  if (next.length === teams.length) back({ erreur: "Équipe introuvable." });
  await store(next);
  back({ ok: "Équipe retirée. Elle disparaît à la prochaine synchro." });
}

export async function setTeamWatch(form: FormData) {
  const error = await checkPin();
  if (error) back({ erreur: error });
  const id = String(form.get("id") ?? "");
  const watch = String(form.get("watch") ?? "none") as WatchPreset;
  if (!(watch in WATCH_PRESETS)) back({ erreur: "Règle de surveillance inconnue." });
  const teams = await currentTeams();
  await store(teams.map((t) => (t.id === id ? { ...t, watch } : t)));
  back({ ok: "Règle de surveillance enregistrée." });
}
