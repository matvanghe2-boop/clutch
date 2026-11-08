import { cookies } from "next/headers";
import { REVEAL_COOKIE } from "./visit";

/** Les verdicts de pronostic déjà découverts sur ce navigateur. */
export async function revealedIds(): Promise<Set<string>> {
  const raw = (await cookies()).get(REVEAL_COOKIE)?.value;
  if (!raw) return new Set();
  for (const text of [raw, decodeURIComponent(raw)]) {
    try {
      const list = JSON.parse(text);
      if (Array.isArray(list)) return new Set(list.filter((x): x is string => typeof x === "string"));
    } catch {}
  }
  return new Set();
}
