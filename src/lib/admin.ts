import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { TeamConfig } from "@/config/follow";
import { loadTeamConfig, parseTeamConfig } from "@/lib/sync/team-config";

/** Cookie qui garde l'empreinte du code des réglages (jamais le code lui-même). */
export const ADMIN_COOKIE = "clutch_admin";

export const pinDigest = (pin: string) => createHash("sha256").update(`clutch:${pin}`).digest("hex");

/** Ce navigateur a déverrouillé les réglages avec le code en vigueur. */
export async function isAdmin(): Promise<boolean> {
  const pin = process.env.CLUTCH_ADMIN_PIN;
  if (!pin) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === pinDigest(pin);
}

/**
 * Dernière liste d'équipes enregistrée depuis ce navigateur. Le CDN de Blob
 * sert encore l'ancienne une minute ou deux : sans ce relais, la page Réglages
 * afficherait l'état d'avant, et une seconde modification l'écraserait.
 */
const RECENT_TEAMS_COOKIE = "clutch_equipes";

export async function currentTeams(): Promise<TeamConfig[]> {
  return parseTeamConfig((await cookies()).get(RECENT_TEAMS_COOKIE)?.value) ?? (await loadTeamConfig());
}

export async function rememberTeams(list: TeamConfig[]) {
  (await cookies()).set(RECENT_TEAMS_COOKIE, JSON.stringify(list), {
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
