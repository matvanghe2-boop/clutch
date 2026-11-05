/**
 * Vérifie les parseurs sur des réponses d'API déjà téléchargées, sans réseau.
 * Usage : tsx scripts/check-parsers.ts <team|tournament> <wiki> <page> <fichier.json|.html>
 */
import fs from "node:fs";
import { FOLLOWED, toFollowed } from "../src/config/follow";
import { parseTeamPage } from "../src/lib/liquipedia/team-page";
import { parseTournamentPage } from "../src/lib/liquipedia/tournament-page";
import type { GameId } from "../src/lib/types";

const [kind, wiki, page, file] = process.argv.slice(2);
const raw = fs.readFileSync(file, "utf8");
const html = file.endsWith(".json") ? JSON.parse(raw).parse.text : raw;
const when = (ts?: number) => (ts ? new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") : "—");

if (kind === "team") {
  const team = FOLLOWED.find((t) => t.game === wiki && t.page === page) ?? toFollowed({ id: "x", game: wiki as GameId, page });
  const r = parseTeamPage(html, team);
  console.log("logo:", r.logo);
  console.log(`à venir (${r.upcoming.length}) :`);
  for (const m of r.upcoming)
    console.log(" ", when(m.timestamp), m.opponents.map((o) => o?.name ?? "TBD").join(" vs "), "|", m.tournament?.name, "·", m.tournament?.stage, "| Bo", m.bestOf ?? "?", "|", m.streams.map((s) => s.platform).join(","));
  console.log(`récents (${r.recent.length}) :`);
  for (const m of r.recent.slice(0, 6))
    console.log(" ", when(m.timestamp), m.result, m.score.join("-"), "vs", m.opponent?.name, `(${m.opponent?.short})`, "|", m.tournament.name);
} else {
  const r = parseTournamentPage(html, wiki as GameId, page);
  console.log("nom:", r.name);
  console.log("infobox:", JSON.stringify(r.info));
  for (const s of r.stages) {
    console.log(`\n## ${s.title} (#${s.anchor})`);
    for (const b of s.blocks) {
      if (b.kind === "group") console.log(`  poule « ${b.table.title} » :`, b.table.rows.map((r) => `${r.rank}.${r.team?.short ?? r.team?.name} ${r.cells.join("/")} [${r.status}]`).join("  "));
      if (b.kind === "matchlist") console.log(`  liste « ${b.list.title} » : ${b.list.matches.length} matchs ; ex.`, when(b.list.matches[0].timestamp), b.list.matches[0].opponents.map((o) => `${o?.name}(${o?.page ?? "?"})`).join(" vs "), b.list.matches[0].scores.join("-"), "round:", b.list.matches[0].round, "games:", b.list.matches[0].games.length);
      if (b.kind === "bracket") {
        for (const sec of b.bracket.sections) {
          let n = 0;
          const labels = new Set<string>();
          const walk = (x: (typeof sec.roots)[number]) => { if (x.match) { n++; if (x.match.round) labels.add(x.match.round); } x.children.forEach(walk); };
          sec.roots.forEach(walk);
          console.log(`  bracket : [${sec.headers.join(" | ")}] ${sec.roots.length} arbre(s), ${n} matchs, tours nommés : ${[...labels].join(", ") || "aucun"}`);
        }
      }
    }
  }
}
