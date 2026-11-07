import * as cheerio from "cheerio";
import type {
  Bracket,
  BracketNode,
  BracketSection,
  GameId,
  Match,
  Matchlist,
  Stage,
  StandingRow,
  StandingTable,
  SwissRound,
  TeamRef,
  TournamentRef,
} from "../types";
import { labelRounds } from "../bracket";
import { type El, logoFrom, makeMatch, popupInfo, scoreWinner, teamFrom, text } from "./html";

export interface ParsedTournament {
  name: string;
  info: Record<string, string>;
  logo?: string;
  startDate?: string;
  endDate?: string;
  participants: TeamRef[];
  stages: Stage[];
}

/** « 2026-11-13 » → tel quel ; une date incomplète (« 2026-11-?? ») ne sert pas au calendrier. */
function isoDate(value?: string): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}

/**
 * Section Participants : une carte par équipe (`.team-participant-card`), ou
 * l'ancien tableau (`.participantTable-entry`) sur les pages plus vieilles.
 * Les places encore à attribuer (« TBD ») ne donnent pas d'équipe.
 */
function parseParticipants($: cheerio.CheerioAPI): TeamRef[] {
  const out: TeamRef[] = [];
  const seen = new Set<string>();
  $(".team-participant-card__opponent, .participantTable-entry").each((_, el) => {
    const team = teamFrom($, $(el));
    const key = team && (team.page ?? team.name).toLowerCase();
    if (!team || !key || seen.has(key)) return;
    seen.add(key);
    out.push(team);
  });
  return out;
}

/**
 * Page d'une compétition. Les blocs (poules, brackets, listes de matchs) sont
 * relevés dans l'ordre de la page et rangés sous le titre de section le plus
 * proche, ce qui donne les phases (« Group Stage », « Playoffs », « Day 2 »…).
 */
export function parseTournamentPage(html: string, wiki: GameId, page: string): ParsedTournament {
  const $ = cheerio.load(html);

  const $header = $(".infobox-header").first().clone();
  $header.find(".infobox-buttons").remove();
  const name = text($header) || page.split("/").join(" ");

  const info: Record<string, string> = {};
  $(".infobox-description").each((_, d) => {
    const key = text($(d)).replace(/:$/, "");
    const $v = $(d).next();
    const links = $v.find("a").toArray().map((a) => text($(a))).filter(Boolean);
    const value = (links.length > 1 ? links.join(", ") : text($v)).replace(/(\S)\(/g, "$1 (");
    if (key && value && !(key in info)) info[key] = value;
  });

  const tournament: TournamentRef = { name, page };
  const stages: Stage[] = [];
  const headings: { level: number; title: string; anchor: string }[] = [];

  const BLOCKS = ".brkts-bracket, .brkts-matchlist, table.grouptable, .table2.standings-group, .table2.standings-swiss";
  $(`.mw-heading, ${BLOCKS}`).each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("mw-heading")) {
      // Une phase = un titre de niveau 2 ou 3 ; les sous-titres (groupes, journées) restent dedans.
      const $h = $el.find("h2, h3").first();
      if (!$h.length) return;
      const level = Number(($h.prop("tagName") ?? "H2").slice(1));
      while (headings.length && headings.at(-1)!.level >= level) headings.pop();
      headings.push({ level, title: text($h), anchor: $h.attr("id") ?? "" });
      return;
    }

    const current = headings.at(-1) ?? { title: "Compétition", anchor: "" };
    let stage = stages.at(-1);
    if (!stage || stage.anchor !== current.anchor) {
      stage = { title: current.title, anchor: current.anchor, blocks: [] };
      stages.push(stage);
    }
    const ctx: TournamentRef = { ...tournament, stage: current.title, anchor: current.anchor.replace(/_/g, " ") };

    if ($el.hasClass("brkts-bracket")) {
      stage.blocks.push({ kind: "bracket", bracket: parseBracket($, $el, wiki, ctx) });
    } else if ($el.hasClass("brkts-matchlist")) {
      const list = parseMatchlist($, $el, wiki, ctx);
      if (list.matches.length) stage.blocks.push({ kind: "matchlist", list });
    } else {
      const table = $el.hasClass("table2") ? parseStandings($, $el) : parseGroupTable($, $el);
      if (table.rows.length) stage.blocks.push({ kind: "group", table });
    }
  });

  for (const stage of stages) dropBracketDuplicates(stage);
  return {
    name,
    info,
    logo: logoFrom($(".infobox-image").first()),
    startDate: isoDate(info["Start Date"]),
    endDate: isoDate(info["End Date"]) ?? isoDate(info["Start Date"]),
    participants: parseParticipants($),
    stages: stages.filter((s) => s.blocks.length),
  };
}

/** Liquipedia double souvent un bracket d'une liste des mêmes matchs : on garde le bracket. */
function dropBracketDuplicates(stage: Stage) {
  const inBrackets = new Set<string>();
  const walk = (n: BracketNode) => {
    if (n.match) inBrackets.add(n.match.id);
    n.children.forEach(walk);
  };
  for (const b of stage.blocks) if (b.kind === "bracket") b.bracket.sections.forEach((sec) => sec.roots.forEach(walk));
  if (!inBrackets.size) return;
  stage.blocks = stage.blocks.filter((b) => b.kind !== "matchlist" || !b.list.matches.every((m) => inBrackets.has(m.id)));
}

function withPopup(
  $: cheerio.CheerioAPI,
  $match: El,
  wiki: GameId,
  base: Omit<Match, "id" | "wiki" | "streams" | "games">,
): Match {
  const $popup = $match.find(".brkts-popup").first();
  if (!$popup.length) return makeMatch(wiki, base);
  const p = popupInfo($, $popup);
  // Les listes n'ont pas de liens sur les équipes : le popup les fournit.
  const opponents = base.opponents.map((o, i) =>
    o ? { ...o, page: o.page ?? p.pages[i]?.page, logo: o.logo ?? p.pages[i]?.logo } : o,
  ) as Match["opponents"];
  return makeMatch(wiki, {
    ...base,
    opponents,
    timestamp: p.timestamp,
    timeTbd: p.timeTbd,
    finished: p.finished || base.finished,
    bestOf: p.bestOf,
    streams: p.streams,
    games: p.games,
  });
}

function parseMatchlist($: cheerio.CheerioAPI, $ml: El, wiki: GameId, ctx: TournamentRef): Matchlist {
  const $title = $ml.find(".brkts-matchlist-title").first();
  const title =
    text($title.find(".general-collapsible-default-title").first()) ||
    text($title).replace(/\s*(Show|Hide)\s*$/i, "");
  const matches: Match[] = [];
  let round: string | undefined;
  $ml.find(".brkts-matchlist-header, .brkts-matchlist-match").each((_, n) => {
    const $n = $(n);
    if ($n.hasClass("brkts-matchlist-header")) {
      // En CS, ces intertitres sont des dates (« October 24, 2026 ») : la colonne date suffit.
      const label = text($n);
      round = label && !/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(label) ? label : undefined;
      return;
    }
    const $opps = $n.children(".brkts-matchlist-opponent").toArray().slice(0, 2);
    if ($opps.length < 2) return;
    const opponents = $opps.map((o) => teamFrom($, $(o), $(o).attr("aria-label"))) as Match["opponents"];
    const scores = $n
      .children(".brkts-matchlist-score")
      .toArray()
      .slice(0, 2)
      .map((s) => text($(s)) || null) as Match["scores"];
    while (scores.length < 2) scores.push(null);
    const winIdx = $opps.findIndex((o) => $(o).hasClass("brkts-matchlist-slot-winner"));
    matches.push(
      withPopup($, $n, wiki, {
        finished: winIdx >= 0,
        opponents,
        scores,
        winner: winIdx >= 0 ? ((winIdx + 1) as 1 | 2) : scoreWinner(scores),
        tournament: ctx,
        // Sans intertitre, le titre de la liste (« Day 6 ») situe le match mieux que la phase.
        round: round ?? (title || undefined),
      }),
    );
  });
  return { title: title || ctx.stage || "Matchs", matches };
}

const headersOf = ($: cheerio.CheerioAPI, $row: El) =>
  $row
    .children(".brkts-header")
    .toArray()
    .map((h) => text($(h).find(".brkts-header-option").first()) || text($(h)));

/**
 * Un bracket est une suite de sections : une ligne d'en-têtes, puis un ou
 * plusieurs arbres (« round-body ») jusqu'à la ligne d'en-têtes suivante.
 * En double élimination, le bracket perdant a sa propre ligne d'en-têtes,
 * nichée dans l'arbre sous la grande finale : il devient une section à part,
 * placée juste après celle du bracket gagnant.
 */
function parseBracket($: cheerio.CheerioAPI, $b: El, wiki: GameId, ctx: TournamentRef): Bracket {
  const sections: BracketSection[] = [];
  const nested: BracketSection[] = [];
  let current: BracketSection | undefined;
  $b.children(".brkts-round-header, .brkts-round-body").each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("brkts-round-header")) {
      sections.push(...nested.splice(0));
      current = { headers: headersOf($, $el), roots: [] };
      sections.push(current);
      return;
    }
    if (!current) sections.push((current = { headers: [], roots: [] }));
    current.roots.push(parseRoundBody($, $el, wiki, ctx, nested));
  });
  sections.push(...nested);
  for (const section of sections) labelRounds(section);
  return { sections: sections.filter((s) => s.roots.length) };
}

function parseRoundBody($: cheerio.CheerioAPI, $body: El, wiki: GameId, ctx: TournamentRef, nested: BracketSection[]): BracketNode {
  const children: BracketNode[] = [];
  $body.children(".brkts-round-upper, .brkts-round-lower").each((_, side) => {
    // Après une ligne d'en-têtes nichée, les arbres appartiennent à une nouvelle section.
    let section: BracketSection | undefined;
    $(side)
      .children(".brkts-round-header, .brkts-round-body")
      .each((_, el) => {
        const $el = $(el);
        if ($el.hasClass("brkts-round-header")) {
          section = { headers: headersOf($, $el), roots: [] };
          nested.push(section);
          return;
        }
        const node = parseRoundBody($, $el, wiki, ctx, nested);
        if (section) {
          delete node.skip;
          section.roots.push(node);
        } else children.push(node);
      });
  });
  const skip = Number($body.attr("style")?.match(/--skip-round:\s*(\d+)/)?.[1] ?? 0);
  const $center = $body.children(".brkts-round-center").first();
  const $match = $center.find(".brkts-match").first();
  if ($match.length) return { match: parseBracketMatch($, $match, wiki, ctx), children, ...(skip ? { skip } : {}) };
  const qualified = $center
    .find(".brkts-opponent-entry")
    .toArray()
    .map((e) => teamFrom($, $(e).find(".block-team").first(), $(e).attr("aria-label")))
    .filter((t): t is TeamRef => t !== null);
  return { match: null, qualified: qualified.length ? qualified : undefined, children, ...(skip ? { skip } : {}) };
}

function parseBracketMatch($: cheerio.CheerioAPI, $m: El, wiki: GameId, ctx: TournamentRef): Match {
  const entries = $m.children(".brkts-opponent-entry").toArray().slice(0, 2);
  const opponents = [0, 1].map((i) => {
    const e = entries[i];
    return e ? teamFrom($, $(e).find(".block-team").first(), $(e).attr("aria-label")) : null;
  }) as Match["opponents"];
  const scores = [0, 1].map((i) => {
    const e = entries[i];
    return e ? text($(e).find(".brkts-opponent-score-inner").first()) || null : null;
  }) as Match["scores"];
  const winIdx = entries.findIndex((e) => $(e).find(".brkts-opponent-win").length > 0);
  return withPopup($, $m, wiki, {
    finished: winIdx >= 0,
    opponents,
    scores,
    winner: winIdx >= 0 ? ((winIdx + 1) as 1 | 2) : undefined,
    tournament: ctx,
  });
}

const STATUSES = new Set(["up", "down", "stay", "stayup", "staydown", "draw"]);

/**
 * Nouveau composant de classement (`.table2.standings-group` pour un
 * championnat, `.standings-swiss` pour un format suisse). Les colonnes sont
 * nommées par l'en-tête ; le suisse ajoute une cellule par ronde.
 */
function parseStandings($: cheerio.CheerioAPI, $wrap: El): StandingTable {
  const $table = $wrap.find("table").first();
  const area = $wrap.closest("[data-toggle-area]").attr("data-toggle-area");
  const heads = $table
    .find("tr")
    .first()
    .children("th")
    .toArray()
    .map((th) => text($(th)));
  const iTeam = heads.findIndex((h) => /participant|team/i.test(h));
  const headers: string[] = [];
  const rows: StandingRow[] = [];

  $table.find("tr.table2__row--body").each((_, tr) => {
    const $tr = $(tr);
    const contentArea = $tr.attr("data-toggle-area-content");
    if (area && contentArea && contentArea !== area) return;
    const tds = $tr.children("td").toArray();
    const $block = $tr.find(".block-team").first();
    const team = teamFrom($, $block);
    if (team) team.short ??= text($block.find(".name.visible-xs").first()) || undefined;
    const status = $tr.attr("data-position-status");
    const cells: string[] = [];
    const rounds: SwissRound[] = [];
    tds.forEach((td, i) => {
      const $td = $(td);
      if (i === 0 || i === iTeam || $td.find(".standings-position-indicator, .block-team").length) return;
      if ($td.hasClass("standings-swiss-match")) {
        const $label = $td.find("[data-label-type]").first();
        const type = $label.attr("data-label-type")?.replace("result-", "");
        rounds.push({
          result: type === "win" || type === "loss" || type === "draw" ? type : undefined,
          score: text($label) || undefined,
          opponent: $td.find(".team-template-team-icon").length ? teamFrom($, $td.find(".team-template-team-icon").first()) : undefined,
        });
        return;
      }
      if (!rows.length && heads[i] !== undefined) headers.push(heads[i]);
      cells.push(text($td).replace(/\s*-\s*/g, "-"));
    });
    rows.push({
      rank: text($(tds[0])),
      team,
      cells,
      status: status && STATUSES.has(status) ? (status as StandingRow["status"]) : undefined,
      rounds: rounds.length ? rounds : undefined,
    });
  });
  return { title: "Classement", headers, rows };
}

function parseGroupTable($: cheerio.CheerioAPI, $t: El): StandingTable {
  const $head = $t.find("tr").first().children("th").first();
  const title = text($head.children("span").first()) || text($head);
  const area = $t.attr("data-toggle-area");
  const rows: StandingRow[] = [];
  $t.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const contentArea = $tr.attr("data-toggle-area-content");
    // Une table à onglets (semaines, tours) contient toutes les étapes : on garde celle affichée par défaut.
    if (area && contentArea && contentArea !== area) return;
    const $slot = $tr.children("td.grouptableslot").first();
    if (!$slot.length) return;
    const status = ($slot.attr("class") ?? "").match(/\bbg-(up|down|stayup|staydown|stay|draw)\b/)?.[1] as
      | StandingRow["status"]
      | undefined;
    rows.push({
      rank: text($tr.children("th").first()).replace(/\.$/, ""),
      team: teamFrom($, $slot),
      cells: $tr
        .children("td")
        .not(".grouptableslot")
        .toArray()
        .map((td) => text($(td))),
      status,
    });
  });
  return { title, rows };
}
