/**
 * Classements de saison, lus sur Liquipedia :
 *   - Counter-Strike : le classement régional de Valve (VRS), recalculé chaque
 *     semaine, mondial puis par région (onglets Global, Europe, Americas, Asia) ;
 *   - Call of Duty League : le classement de la saison régulière, un tableau
 *     de poule comme ceux des compétitions.
 * La Rocket League n'a pas (encore) de classement à points pour la saison
 * 2027 : la page « Qualification » ne liste que les équipes qualifiées.
 */
import * as cheerio from "cheerio";
import type { Ranking, RankingRow } from "../types";
import { teamFrom, text } from "./html";
import { parseTournamentPage } from "./tournament-page";

const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && s.trim() ? n : undefined;
};

/** Le VRS : rang mondial et points, complétés du rang dans sa région. */
export function parseVrs(html: string, page: string): Omit<Ranking, "fetchedAt"> {
  const $ = cheerio.load(html);
  const rows: RankingRow[] = [];
  const regional = new Map<string, { rank: number; region: string }>();
  let updated: string | undefined;

  const tabs = $(".tabs-dynamic").first();
  const labels = tabs.find("[data-tabs-nav] li").toArray().map((li) => text($(li)));
  tabs
    .find("[data-tabs-content]")
    .first()
    .children()
    .each((i, content) => {
      const $table = $(content).find("table").first();
      const heads = $table.find("tr").first().children("th").toArray().map((th) => text($(th)).toLowerCase());
      const col = (name: string) => heads.indexOf(name);
      const [iRank, iPoints, iTeam, iRegion] = [col("rank"), col("points"), col("team"), col("region")];
      if (iRank < 0 || iTeam < 0) return;
      updated ??= $(content).find(".ranking-table__top-row-multiline span").first().text().match(/\d{4}-\d{2}-\d{2}/)?.[0];
      $table.find("tr.table2__row--body").each((_, tr) => {
        const tds = $(tr).children("td").toArray();
        const rank = num(text($(tds[iRank])));
        const team = teamFrom($, $(tds[iTeam]));
        if (rank === undefined || !team) return;
        if (i === 0) {
          rows.push({
            rank,
            team,
            points: iPoints >= 0 ? text($(tds[iPoints])) : undefined,
            region: iRegion >= 0 ? text($(tds[iRegion])) || undefined : undefined,
          });
        } else if (team.page && !regional.has(team.page)) {
          regional.set(team.page, { rank, region: labels[i] ?? "" });
        }
      });
    });

  for (const row of rows) {
    const r = row.team.page ? regional.get(row.team.page) : undefined;
    if (r) Object.assign(row, { regionRank: r.rank, regionName: r.region });
  }
  return { wiki: "counterstrike", page, title: "Classement Valve (VRS)", updated, columns: ["Points"], rows };
}

/** Classement de la saison régulière CDL : le tableau de poule de la page. */
export function parseSeasonStandings(html: string, page: string, title: string): Omit<Ranking, "fetchedAt"> {
  const parsed = parseTournamentPage(html, "callofduty", page);
  const tables = parsed.stages.flatMap((s) => s.blocks).flatMap((b) => (b.kind === "group" ? [b.table] : []));
  const table = tables.find((t) => /regular season/i.test(t.title ?? "")) ?? tables[0];
  const rows: RankingRow[] = (table?.rows ?? []).flatMap((r) => {
    const rank = num(r.rank);
    return r.team && rank !== undefined ? [{ rank, team: r.team, cells: r.cells }] : [];
  });
  return { wiki: "callofduty", page, title, columns: table?.headers ?? [], rows };
}
