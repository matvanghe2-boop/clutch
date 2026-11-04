import * as cheerio from "cheerio";
import type { GameId, PortalEntry } from "../types";
import { parseHref, text } from "./html";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const month = (s: string) => MONTHS[s.slice(0, 3).toLowerCase()];

/**
 * Dates d'une ligne de liste : « Dec 09–13, 2026 », « Nov 22 – Dec 12, 2027 »,
 * « Dec 28 – Jan 03, 2027 » (l'année est celle de la fin), « Nov 05, 2026 ».
 * « TBA », « Postponed » ou un mois seul ne donnent rien : pas de date, pas de calendrier.
 */
export function parseRange(raw: string): { start?: string; end?: string } {
  const s = raw.replace(/\s+/g, " ").trim();
  let m = s.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}) ?[–-] ?(\d{1,2}), (\d{4})$/);
  if (m && month(m[1])) return { start: iso(+m[4], month(m[1]), +m[2]), end: iso(+m[4], month(m[1]), +m[3]) };
  m = s.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}) ?[–-] ?([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})$/);
  if (m && month(m[1]) && month(m[3])) {
    const endYear = +m[5];
    const startYear = month(m[1]) > month(m[3]) ? endYear - 1 : endYear;
    return { start: iso(startYear, month(m[1]), +m[2]), end: iso(endYear, month(m[3]), +m[4]) };
  }
  m = s.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})$/);
  if (m && month(m[1])) {
    const d = iso(+m[3], month(m[1]), +m[2]);
    return { start: d, end: d };
  }
  return {};
}

/**
 * Liste par niveau (« S-Tier Tournaments ») : un tableau par année, une ligne
 * par compétition. Les colonnes sont repérées par leur en-tête. On ne garde
 * que ce qui n'est pas terminé : c'est la vue à plusieurs mois du calendrier.
 */
export function parseListing(html: string, wiki: GameId, listPage: string, today: string): PortalEntry[] {
  const $ = cheerio.load(html);
  const tier = listPage.replace(/ Tournaments$/, "");
  const out: PortalEntry[] = [];
  const seen = new Set<string>();

  $(".tournaments-listing").each((_, table) => {
    // « Tournament » couvre deux colonnes (icône, nom) : on suit l'étendue des en-têtes.
    const heads: { label: string; at: number }[] = [];
    let at = 0;
    $(table)
      .find("tr.table2__row--head th")
      .each((_, th) => {
        heads.push({ label: text($(th)).toLowerCase(), at });
        at += Number($(th).attr("colspan") ?? 1);
      });
    const col = (label: RegExp) => heads.find((h) => label.test(h.label))?.at ?? -1;
    const iDate = col(/^date/);
    const iPrize = col(/prize/);
    const iLocation = col(/location/);
    const iWinner = col(/^winner/);

    $(table)
      .find("tr.table2__row--body")
      .each((_, tr) => {
        const tds = $(tr).children("td");
        const link = $(tr).find("td.column__tournament a[href]").last();
        const target = parseHref(link.attr("href"));
        if (!target || target.wiki !== wiki || seen.has(target.page)) return;
        const cell = (i: number) => (i >= 0 ? text(tds.eq(i)) : "");
        if (/cancel/i.test(cell(iWinner))) return;
        const { start, end } = parseRange(cell(iDate));
        if (!start || !end || end < today) return;
        seen.add(target.page);
        out.push({
          wiki,
          page: target.page,
          name: text(link) || target.page,
          status: start > today ? "upcoming" : "ongoing",
          startDate: start,
          endDate: end,
          location: cell(iLocation) || undefined,
          prize: cell(iPrize) || undefined,
          tier,
        });
      });
  });
  return out;
}
