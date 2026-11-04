import { createHash } from "node:crypto";
import { cookies } from "next/headers";

/** Cookie qui garde l'empreinte du code des réglages (jamais le code lui-même). */
export const ADMIN_COOKIE = "clutch_admin";

export const pinDigest = (pin: string) => createHash("sha256").update(`clutch:${pin}`).digest("hex");

/** Ce navigateur a déverrouillé les réglages avec le code en vigueur. */
export async function isAdmin(): Promise<boolean> {
  const pin = process.env.CLUTCH_ADMIN_PIN;
  if (!pin) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === pinDigest(pin);
}
