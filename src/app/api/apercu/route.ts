import { NextResponse } from "next/server";
import { GAME_IDS, GAMES } from "@/config/follow";
import { findMatch, findTeamRef, formOf, historyOf, opponentKey, rankOf, statusOf, teamById, upcomingFeed } from "@/lib/derive";
import { clock, dayLabel } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { largeLogo, teamColors } from "@/lib/team-colors";
import type { GameId, TeamRef } from "@/lib/types";

/**
 * Ce qu'affiche l'aperçu au survol d'un lien (src/lib/motion/peek.ts) : une équipe ou un match, en
 * quelques lignes. Mis en cache une minute sur le réseau de Vercel : survoler beaucoup de liens ne
 * relit pas la base à chaque fois. Une réponse vide, elle, n'est jamais gardée.
 */
export const dynamic = "force-dynamic";

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

interface Peek {
  kind: "team" | "match";
  name: string;
  game: string;
  logo?: string;
  color?: string;
  form?: string[];
  rank?: string;
  next?: string;
  them?: { name: string; logo?: string; color?: string };
  center?: string;
  detail?: string;
}

function teamPeek(team: TeamRef, game: GameId, form: string[] | undefined, rank: string | undefined, next: string | undefined): Peek {
  return { kind: "team", name: team.name, game: GAMES[game].label, logo: largeLogo(team), color: teamColors(team)?.a, form, rank, next };
}

export async function GET(request: Request) {
  const href = new URL(request.url).searchParams.get("href") ?? "";
  const path = decodeURIComponent(href.split(/[?#]/)[0]);
  const snap = await loadSnapshot();
  const now = Date.now() / 1000;
  let peek: Peek | null = null;

  const followed = /^\/equipe\/([^/]+)$/.exec(path);
  const other = /^\/equipes\/([^/]+)\/(.+)$/.exec(path);
  const match = /^\/match\/(.+)$/.exec(path);

  if (followed) {
    const team = teamById(snap, followed[1]);
    if (team) {
      const ref = { name: team.page, page: team.page, logo: snap.teams[team.id]?.logo };
      const next = upcomingFeed(snap).find((o) => o.team.id === team.id && statusOf(o.match, now) === "upcoming");
      const row = rankOf(snap, team.game, ref);
      peek = teamPeek(
        ref,
        team.game,
        formOf(historyOf(snap, team)).last,
        row ? ordinal(row.rank) : undefined,
        next?.match.timestamp ? `${dayLabel(next.match.timestamp, now)}${next.match.timeTbd ? "" : ` · ${clock(next.match.timestamp)}`} contre ${next.them?.short ?? next.them?.name ?? "?"}` : undefined,
      );
    }
  } else if (other && GAME_IDS.includes(other[1] as GameId)) {
    const game = other[1] as GameId;
    const page = other[2].replace(/_/g, " ");
    const fiche = snap.opponents?.[opponentKey(game, page)];
    const ref = findTeamRef(snap, game, page) ?? (fiche ? { name: fiche.name, page, logo: fiche.logo } : { name: page, page });
    const row = rankOf(snap, game, ref);
    peek = teamPeek(ref, game, fiche ? formOf(fiche.recent).last : undefined, row ? ordinal(row.rank) : undefined, undefined);
  } else if (match) {
    const found = findMatch(snap, match[1]);
    if (found) {
      const { o } = found;
      const m = o.match;
      const st = statusOf(m, now);
      peek = {
        kind: "match",
        name: o.us.name,
        game: GAMES[m.wiki].label,
        logo: largeLogo(o.us),
        color: teamColors(o.us)?.a,
        them: o.them ? { name: o.them.name, logo: largeLogo(o.them), color: teamColors(o.them)?.a } : undefined,
        center: st === "done" || st === "live" ? `${o.usScore ?? 0}–${o.themScore ?? 0}` : m.timestamp && !m.timeTbd ? clock(m.timestamp) : "VS",
        detail: [st === "live" ? "En direct" : m.timestamp ? dayLabel(m.timestamp, now) : "Horaire à venir", m.tournament?.name].filter(Boolean).join(" · "),
      };
    }
  }

  // Une réponse vide ne se garde pas : une lecture ratée de la base (instantané vide) bloquerait
  // sinon l'aperçu de ce lien pendant plusieurs minutes, pour tout le monde.
  const cacheControl = peek ? "public, s-maxage=60, stale-while-revalidate=120" : "no-store";
  return NextResponse.json(peek, { headers: { "Cache-Control": cacheControl } });
}
