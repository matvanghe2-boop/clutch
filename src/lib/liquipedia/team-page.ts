import * as cheerio from "cheerio";
import type { FollowedTeam } from "../../config/follow";
import type { FormerPlayer, Match, Palmares, PalmaresRow, RecentMatch, RosterEntry, TeamAward, TeamInfo, TeamRef } from "../types";
import { clean, type El, logoFrom, makeMatch, parseHref, scoreWinner, streamsFrom, teamFrom, text, timerFrom } from "./html";

export interface ParsedTeamPage {
  logo?: string;
  upcoming: Match[];
  recent: RecentMatch[];
  roster: RosterEntry[];
  timeline: string[];
  info?: TeamInfo;
  former: FormerPlayer[];
  awards: TeamAward[];
  records: string[];
}

/** Page « Équipe/Matches » : tout l'historique, dans le même tableau que « Recent Matches ». */
export function parseMatchHistory(html: string): RecentMatch[] {
  return parseRecent(cheerio.load(html));
}

/**
 * Effectif actif : le premier tableau de la section « Player Roster » (onglet
 * Active). Colonnes repérées par leur en-tête ; la colonne sans titre porte le
 * rôle ou le statut (« RFA », « Substitute »…).
 */
function parseRoster($: cheerio.CheerioAPI): RosterEntry[] {
  const $table = $("#Player_Roster").closest(".mw-heading").nextAll().find("table").addBack("table").first();
  if (!$table.length) return [];
  const heads = $table
    .find("tr")
    .first()
    .children("th")
    .toArray()
    .map((th) => text($(th)).toLowerCase());
  const at = (re: RegExp) => heads.findIndex((h) => re.test(h));
  const iId = at(/^id$/);
  const iName = at(/^name$/);
  const iJoin = at(/join/);
  const iRole = heads.findIndex((h, i) => (h === "" || /position|role/.test(h)) && i !== iId);
  const out: RosterEntry[] = [];
  $table.find("tr").each((_, tr) => {
    const tds = $(tr).children("td");
    if (tds.length < 2) return;
    const $id = tds.eq(iId >= 0 ? iId : 0);
    const player = text($id.find(".inline-player a, a").first()) || text($id);
    if (!player) return;
    const $flag = $id.find(".flag img").first();
    out.push({
      id: player,
      name: iName >= 0 ? text(tds.eq(iName)) || undefined : undefined,
      role: iRole >= 0 ? text(tds.eq(iRole)) || undefined : undefined,
      joined: iJoin >= 0 ? text(tds.eq(iJoin)).match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined,
      country: $flag.attr("title") || $flag.attr("alt") || undefined,
      captain: $id.find(".fa-crown").length > 0,
    });
  });
  return out;
}

/**
 * Derniers mouvements : l'onglet actif (l'année en cours) de la section
 * « Timeline », du plus récent au plus ancien, sans les renvois aux sources.
 */
function parseTimeline($: cheerio.CheerioAPI): string[] {
  const $section = $("#Timeline").closest(".mw-heading");
  if (!$section.length) return [];
  const $tabs = $section.nextAll(".tabs-dynamic, div").first();
  const $active = $tabs.find(".tabs-content > .active").first();
  const $list = ($active.length ? $active : $section.nextAll("ul").first()).find("li");
  return $list
    .toArray()
    .map((li) => {
      const $li = $(li).clone();
      $li.find("sup").remove();
      return text($li);
    })
    .filter(Boolean)
    .reverse()
    .slice(0, 6);
}

/**
 * Page d'une équipe : le carrousel « Upcoming Matches » (horaires, streams,
 * compétition, phase) et l'onglet « Recent Matches » de la section Results.
 */
export function parseTeamPage(html: string, team: FollowedTeam): ParsedTeamPage {
  const $ = cheerio.load(html);
  let logo: string | undefined;

  const self = (short: string, $block: El): TeamRef => {
    const l = logoFrom($block);
    logo ??= l;
    return { name: team.page, short: short || undefined, page: team.page, logo: l };
  };

  const upcoming: Match[] = [];
  $(".carousel-item .match-info").each((_, el) => {
    const $m = $(el);
    const { timestamp, finished, timeTbd } = timerFrom($m);
    const $t = $m.find(".match-info-tournament-name a").first();
    const target = parseHref($t.attr("href"));
    const stage = text($m.find(".match-info-stage").first()) || undefined;
    let name = text($t);
    if (stage && name.endsWith(` - ${stage}`)) name = name.slice(0, -(stage.length + 3));

    const rows = $m.find(".match-info-opponent-row").toArray().slice(0, 2);
    if (rows.length < 2) return;
    const opponents = rows.map((r) => {
      const $b = $(r).find(".block-team").first();
      if ($b.find(".mw-selflink").length) return self(text($b.find(".name").first()), $b);
      return teamFrom($, $b);
    }) as [TeamRef | null, TeamRef | null];
    const scores = rows.map((r) => text($(r).find(".match-info-opponent-score").first()) || null) as [
      string | null,
      string | null,
    ];
    const bo = clean($m.find(".match-info-header").text()).match(/\bBo(\d+)\b/i);

    upcoming.push(
      makeMatch(team.game, {
        timestamp,
        timeTbd,
        finished,
        opponents,
        scores,
        winner: finished ? scoreWinner(scores) : undefined,
        bestOf: bo ? Number(bo[1]) : undefined,
        tournament: { name: name || target?.page || "?", page: target?.page, anchor: target?.anchor, stage },
        streams: streamsFrom($, $m),
      }),
    );
  });

  logo ??= logoFrom($(".infobox-image").first());

  return {
    logo,
    upcoming,
    recent: parseRecent($),
    roster: parseRoster($),
    timeline: parseTimeline($),
    info: parseInfo($),
    former: parseFormer($),
    awards: parseAwards($),
    records: parseRecords($),
  };
}

/** Colonnes d'un tableau d'après sa ligne d'en-têtes, en tenant compte des colspan. */
function headerColumns($: cheerio.CheerioAPI, $table: El) {
  const columns: { label: string; first: number; last: number }[] = [];
  let col = 0;
  $table
    .find("tr")
    .first()
    .children("th")
    .each((_, th) => {
      const span = Number($(th).attr("colspan") ?? 1);
      columns.push({ label: text($(th)).toLowerCase(), first: col, last: col + span - 1 });
      col += span;
    });
  return (label: RegExp, which: "first" | "last" = "last") => {
    const c = columns.find((x) => label.test(x.label));
    return c ? c[which] : -1;
  };
}

/** Texte sans les renvois aux sources (« [12] »). */
const noRefs = (s: string) => clean(s.replace(/\[\d+\]/g, ""));

const STAFF: [RegExp, string][] = [
  [/^founders?/i, "Fondateurs"],
  [/^ceo/i, "CEO"],
  [/^manager/i, "Manager"],
  [/^in-game leader/i, "IGL"],
  [/^coach/i, "Coachs"],
];

/** Carte d'identité : l'infobox de la page d'équipe. */
function parseInfo($: cheerio.CheerioAPI): TeamInfo | undefined {
  const info: TeamInfo = { staff: [] };
  $(".infobox-description").each((_, el) => {
    const label = text($(el)).replace(/:$/, "");
    const $value = $(el).next();
    const value = noRefs(text($value));
    if (/^location/i.test(label)) {
      // Le premier lien porte le drapeau, sans texte ; le second, le pays.
      info.location =
        $value
          .find("a")
          .toArray()
          .map((a) => text($(a)))
          .find(Boolean) || value;
    }
    else if (/^region/i.test(label)) info.region = value;
    else if (/total winnings/i.test(label)) info.winnings = value;
    else if (/^created/i.test(label)) info.created = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    else if (/^lprating/i.test(label)) {
      const m = value.match(/(\d+)(?:\s*\(Rank #(\d+)\))?/);
      if (m) {
        info.lpRating = Number(m[1]);
        if (m[2]) info.lpRank = Number(m[2]);
      }
    } else {
      const role = STAFF.find(([re]) => re.test(label));
      if (!role) return;
      // Un nom par ligne : le texte brut les collerait (« Nicolas Maurer Fabien Devide »).
      const names = ($value.html() ?? "")
        .split(/<br\s*\/?>/i)
        .map((part) => noRefs(cheerio.load(`<div>${part}</div>`)("div").text()))
        .filter(Boolean);
      if (names.length) info.staff.push({ role: role[1], names });
    }
  });
  return info.location || info.region || info.created || info.winnings || info.staff.length ? info : undefined;
}

/** Anciens joueurs : les tableaux à colonne « Leave Date » de la section Player Roster (un par jeu ou par onglet). */
function parseFormer($: cheerio.CheerioAPI): FormerPlayer[] {
  const out = new Map<string, FormerPlayer>();
  $("#Player_Roster")
    .closest(".mw-heading")
    .nextUntil(".mw-heading2")
    .find("table")
    .each((_, table) => {
      const $table = $(table);
      const at = headerColumns($, $table);
      const iLeave = at(/^leave/);
      if (iLeave < 0) return;
      const [iId, iName, iJoin, iNext] = [at(/^id$/), at(/^name$/), at(/^join/), at(/new team/)];
      $table.find("tr").each((_, tr) => {
        const tds = $(tr).children("td");
        if (tds.length <= iLeave) return;
        const $id = tds.eq(iId >= 0 ? iId : 0);
        const id = text($id.find(".inline-player a, a").first()) || text($id);
        if (!id) return;
        const joined = text(tds.eq(iJoin)).match(/\d{4}-\d{2}-\d{2}/)?.[0];
        const $next = iNext >= 0 ? tds.eq(iNext) : undefined;
        out.set(`${id}|${joined}`, {
          id,
          name: iName >= 0 ? noRefs(text(tds.eq(iName))) || undefined : undefined,
          joined,
          left: text(tds.eq(iLeave)).match(/\d{4}-\d{2}-\d{2}/)?.[0],
          next: ($next && (noRefs(text($next)) || $next.find("a[title]").first().attr("title"))) || undefined,
        });
      });
    });
  return [...out.values()].sort((a, b) => (b.left ?? "").localeCompare(a.left ?? "")).slice(0, 15);
}

/** Distinctions : un tableau (MVP par joueur, en Rocket League) ou une liste (titres du club, en CS2). */
function parseAwards($: cheerio.CheerioAPI): TeamAward[] {
  const $block = $('[id="Awards"]').closest(".mw-heading").nextUntil(".mw-heading");
  const $table = $block.find("table").addBack("table").first();
  if ($table.length) {
    const at = headerColumns($, $table);
    const [iDate, iTier, iTour, iAward, iPlayer] = [at(/^date/), at(/^tier/), at(/^tournament/), at(/^award/), at(/^player/)];
    if (iAward < 0) return [];
    const out: TeamAward[] = [];
    $table.find("tr").each((_, tr) => {
      const tds = $(tr).children("td");
      if (tds.length <= iAward) return;
      const award = text(tds.eq(iAward));
      if (!award) return;
      out.push({
        award,
        date: iDate >= 0 ? text(tds.eq(iDate)).match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined,
        tier: iTier >= 0 ? text(tds.eq(iTier)) || undefined : undefined,
        tournament: iTour >= 0 ? text(tds.eq(iTour)) || undefined : undefined,
        player: iPlayer >= 0 ? text(tds.eq(iPlayer)) || undefined : undefined,
      });
    });
    return out.slice(0, 12);
  }
  return listItems($, $block)
    .map((award) => ({ award }))
    .slice(0, 12);
}

function listItems($: cheerio.CheerioAPI, $block: El): string[] {
  return $block
    .find("li")
    .addBack("li")
    .toArray()
    // Seulement les feuilles : un élément qui contient une sous-liste n'est qu'une catégorie.
    .filter((li) => $(li).find("ul").length === 0)
    .map((li) => {
      const $li = $(li).clone();
      $li.find("sup").remove();
      return noRefs(text($li));
    })
    .filter(Boolean);
}

/** Faits marquants du club : la section Records, quand elle existe. */
function parseRecords($: cheerio.CheerioAPI): string[] {
  return listItems($, $('[id="Records"]').closest(".mw-heading").nextUntil(".mw-heading")).slice(0, 6);
}

/** Palmarès : la sous-page « Results », de la compétition la plus récente à la plus ancienne. */
export function parsePalmares(html: string): Omit<Palmares, "fetchedAt"> {
  const $ = cheerio.load(html);
  const $table = $("table.table2__table").first();
  const at = headerColumns($, $table);
  const [iDate, iPlace, iTier, iTour, iPrize] = [at(/^date/), at(/^place/), at(/^tier/), at(/^tournament/), at(/^prize/)];
  const rows: PalmaresRow[] = [];
  if (iPlace >= 0 && iTour >= 0)
    $table.find("tr").each((_, tr) => {
      const tds = $(tr).children("td");
      if (tds.length <= iTour) return;
      const place = text(tds.eq(iPlace));
      if (!place) return;
      const $link = tds.eq(iTour).find("a[href]").first();
      const name = text(tds.eq(iTour)) || $link.attr("title");
      if (!name) return;
      const target = parseHref($link.attr("href"));
      const prize = iPrize >= 0 ? text(tds.eq(iPrize)) : "";
      // Un rang exact seulement : « 1st - 3rd » (phase de groupes, qualification) n'est pas un titre.
      const exact = place.match(/^(\d+)(?:st|nd|rd|th)$/);
      rows.push({
        date: iDate >= 0 ? text(tds.eq(iDate)).match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined,
        place,
        rank: exact ? Number(exact[1]) : undefined,
        tier: iTier >= 0 ? text(tds.eq(iTier)) || undefined : undefined,
        tournament: { name, page: target?.page },
        prize: /\d/.test(prize) ? prize : undefined,
      });
    });
  const titles = rows.filter((r) => r.rank === 1);
  return {
    rows: rows.slice(0, 40),
    events: rows.length,
    titles: titles.length,
    finals: rows.filter((r) => r.rank === 2).length,
    podiums: rows.filter((r) => r.rank !== undefined && r.rank <= 3).length,
    majorTitles: titles.filter((r) => r.tier === "S-Tier").length,
  };
}

/**
 * Onglet « Recent Matches ». Deux formats coexistent selon les wikis :
 * l'ancien (`.recent-matches`, date et heure en colonnes, résultat dans la
 * classe de ligne) et le nouveau (`.match-table-wrapper`, horodatage et
 * libellé de résultat). Les colonnes sont repérées par leur en-tête.
 */
function parseRecent($: cheerio.CheerioAPI): RecentMatch[] {
  const $table = $(".recent-matches table, .match-table-wrapper table").first();
  if (!$table.length) return [];

  const columns: { label: string; first: number; last: number }[] = [];
  let col = 0;
  $table
    .find("tr")
    .first()
    .children("th")
    .each((_, th) => {
      const span = Number($(th).attr("colspan") ?? 1);
      columns.push({ label: text($(th)).toLowerCase(), first: col, last: col + span - 1 });
      col += span;
    });
  const at = (label: RegExp, which: "first" | "last" = "last") => {
    const c = columns.find((x) => label.test(x.label));
    return c ? c[which] : -1;
  };
  const iDate = at(/^date/);
  const iTime = at(/^time/);
  const iTier = at(/^tier/);
  const iTour = at(/^tournament/);
  const iScore = at(/^score/);
  const iOpp = at(/vs/);

  const out: RecentMatch[] = [];
  $table.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.children("td");
    if (tds.length < 4) return;
    const cell = (i: number) => (i >= 0 ? tds.eq(i) : $([]));

    let timestamp = timerFrom($tr).timestamp;
    if (timestamp === undefined) {
      const date = text(cell(iDate));
      const time = text(cell(iTime)).match(/(\d{1,2}):(\d{2})/);
      const tz = cell(iTime).find("abbr").attr("data-tz") ?? "+00:00";
      const iso = `${date}T${time ? `${time[1].padStart(2, "0")}:${time[2]}` : "00:00"}:00${tz}`;
      timestamp = Math.round(Date.parse(iso) / 1000);
    }
    if (!timestamp || !Number.isFinite(timestamp)) return;

    // « 2:1 » en général, « 13 - 4 » pour un Bo1 de CS2 (le score de la carte).
    const rawScore = text(cell(iScore));
    const pair = rawScore.match(/^\s*(\S+?)\s*[:\-–]\s*(\S+)\s*$/);
    const score = pair ? [pair[1], pair[2]] : rawScore.split(":").map((x) => x.trim());
    const label =
      ($tr.attr("class") ?? "").match(/recent-matches-bg-(win|lose|loss|draw|tie)/)?.[1] ??
      $tr.find("[data-label-type^='result-']").first().attr("data-label-type")?.replace("result-", "");
    const fromScore = scoreWinner([score[0] ?? null, score[1] ?? null]);
    const result: RecentMatch["result"] =
      label === "win" ? "win" : label === "lose" || label === "loss" ? "loss" : label === "draw" || label === "tie" ? "draw"
        : fromScore === 1 ? "win" : fromScore === 2 ? "loss" : "draw";

    const $tl = cell(iTour).find("a[href]").first();
    const target = parseHref($tl.attr("href"));
    out.push({
      timestamp,
      tournament: { name: text($tl) || text(cell(iTour)), page: target?.page, anchor: target?.anchor },
      tier: text(cell(iTier)) || undefined,
      score: [score[0] ?? "", score[1] ?? ""],
      result,
      opponent: recentOpponent($, cell(iOpp)),
    });
  });
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

/** Le gabarit court met l'abréviation dans le texte et le nom complet dans le lien. */
function recentOpponent($: cheerio.CheerioAPI, $cell: El): TeamRef | null {
  const link = $cell.find("a[href]").first();
  const name = link.attr("title") || text($cell);
  if (!name) return null;
  return {
    name,
    short: text($cell.find(".team-template-text, .name").first()) || undefined,
    page: parseHref(link.attr("href"))?.page,
    logo: logoFrom($cell),
  };
}
