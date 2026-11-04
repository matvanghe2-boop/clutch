import type { GameId, PortalEntry } from "../types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const SECTIONS: Record<string, PortalEntry["status"]> = {
  upcoming: "upcoming",
  ongoing: "ongoing",
  completed: "completed",
  concluded: "completed",
};

/**
 * « Nov 13 » → AAAA-MM-JJ. La liste ne donne pas l'année : on prend celle qui
 * place la date au plus près d'aujourd'hui (une compétition « à venir » de
 * janvier, lue en novembre, est l'année suivante).
 */
function withYear(raw: string | undefined, now: Date): string | undefined {
  const m = raw?.trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/);
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return undefined;
  const day = Number(m[2]);
  const year = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]
    .map((y) => ({ y, diff: Math.abs(Date.UTC(y, month - 1, day) - now.getTime()) }))
    .sort((a, b) => a.diff - b.diff)[0].y;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Liquipedia:Tournaments, la liste que Liquipedia tient à la main pour sa barre
 * latérale. Une section par statut (« *Upcoming »), puis une ligne par
 * compétition : « **Page|Nom|clé=valeur|… », espaces facultatifs autour des barres.
 */
export function parsePortal(wikitext: string, wiki: GameId, now = new Date()): PortalEntry[] {
  const out: PortalEntry[] = [];
  let status: PortalEntry["status"] | undefined;
  for (const line of wikitext.split("\n")) {
    const section = line.match(/^\*\s*([A-Za-z]+)\s*$/);
    if (section) {
      status = SECTIONS[section[1].toLowerCase()];
      continue;
    }
    if (!status || !line.startsWith("**")) continue;
    const parts = line.slice(2).split("|").map((p) => p.trim());
    const page = parts[0]?.replace(/_/g, " ");
    if (!page) continue;
    const params: Record<string, string> = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    }
    const name = parts[1] && !parts[1].includes("=") ? parts[1] : page.split("/").join(" ");
    out.push({
      wiki,
      page,
      name,
      status,
      startDate: withYear(params.startdate, now),
      endDate: withYear(params.enddate, now),
    });
  }
  return out;
}
