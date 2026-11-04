import { cookies } from "next/headers";

/**
 * Compétitions masquées : une préférence de ce navigateur, gardée dans un
 * cookie (clés « wiki:page »). Rien à configurer, rien de partagé.
 */
export const HIDDEN_COOKIE = "clutch_masquees";

export async function readHidden(): Promise<Set<string>> {
  try {
    const raw = (await cookies()).get(HIDDEN_COOKIE)?.value;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
