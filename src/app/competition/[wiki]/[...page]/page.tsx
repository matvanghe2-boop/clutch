import type { Metadata } from "next";
import Link from "next/link";
import { GAME_IDS } from "@/config/follow";
import { BracketSectionView, GroupTableView, MatchlistView, ScheduleView } from "@/components/competition";
import { cn, Empty, GameTag } from "@/components/ui";
import { competitionHref, isTeam, sameMatch, teamIn, teamsOf, upcomingFeed } from "@/lib/derive";
import { infoDate } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { loadSnapshot } from "@/lib/load-snapshot";
import { tournamentKey } from "@/lib/snapshot";
import { tournamentMatches } from "@/lib/tournament";
import type { GameId, Match, StageBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ wiki: string; page: string[] }>;

function resolve(wiki: string, segments: string[]) {
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const page = segments.map(decode).join("/").replace(/_/g, " ");
  const game = GAME_IDS.find((g) => g === wiki) as GameId | undefined;
  return { game, page };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { wiki, page } = await params;
  const r = resolve(wiki, page);
  const t = r.game ? (await loadSnapshot()).tournaments[tournamentKey(r.game, r.page)] : undefined;
  return { title: t?.name ?? r.page };
}

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { wiki, page: segments } = await params;
  const onlyOurs = (await searchParams).mes === "1";
  const { game, page } = resolve(wiki, segments);
  const snap = await loadSnapshot();
  const t = game ? snap.tournaments[tournamentKey(game, page)] : undefined;
  const source = `https://liquipedia.net/${wiki}/${pageToPath(page)}`;

  if (!game || !t) {
    return (
      <Empty>
        Cette compétition n&apos;est pas synchronisée : Clutch ne suit que celles où jouent tes équipes.{" "}
        <a href={source} target="_blank" rel="noopener noreferrer" className="text-dim underline">
          La voir sur Liquipedia
        </a>
      </Empty>
    );
  }

  const team = teamIn(teamsOf(snap), t);
  if (!team) return <Empty>Plus aucune équipe suivie dans ce jeu : cette compétition n&apos;est plus synchronisée.</Empty>;
  const now = Date.now() / 1000;

  // Parcours de l'équipe : matchs de la page de compétition, complétés par ceux annoncés sur sa page.
  const ours = new Map<string, Match>();
  for (const m of tournamentMatches(t)) if (m.opponents.some((o) => isTeam(o, team))) ours.set(m.id, m);
  for (const o of upcomingFeed(snap, game))
    if (o.match.tournament?.page === t.page && ![...ours.values()].some((m) => sameMatch(m, o.match))) ours.set(o.match.id, o.match);
  const journey = [...ours.values()].sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity));

  const start = infoDate(t.info["Start Date"], now);
  const end = infoDate(t.info["End Date"], now);
  const meta = [
    start && end && start !== end ? `${start} → ${end}` : (start ?? end),
    [t.info["Venue"], t.info["Location"]].filter(Boolean).join(", "),
    t.info["Prize Pool"],
    t.info["Type"],
  ].filter(Boolean);

  const base = competitionHref(game, t.page);

  return (
    <div data-game={game} className="space-y-10">
      <header className="arena p-5 sm:p-8">
        <div className="arena-left relative">
          <div className="flex items-center justify-between gap-3">
            <GameTag game={game} long />
            <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-faint hover:text-dim">
              Source : Liquipedia ↗
            </a>
          </div>
          <h1 className="display mt-3 text-4xl sm:text-6xl">{t.name}</h1>
          {meta.length > 0 && <p className="mt-2 text-sm text-dim">{meta.join(" · ")}</p>}
        </div>
      </header>

      <ScheduleView matches={tournamentMatches(t)} team={team} now={now} onlyOurs={onlyOurs} />

      {journey.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Parcours de {team.page}</h2>
          <MatchlistView list={{ title: `${journey.length} match${journey.length > 1 ? "s" : ""} de ${team.page}`, matches: journey }} team={team} now={now} onlyOurs={false} />
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="scrollbar-thin flex min-w-0 gap-1.5 overflow-x-auto" aria-label="Phases">
          {t.stages.map((s) => (
            <a
              key={s.anchor}
              href={`#${s.anchor}`}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-sm text-dim transition-colors hover:border-[var(--accent)] hover:text-ink"
            >
              {s.title}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 rounded-full border border-line p-0.5 text-sm">
          {[
            { label: "Tous les matchs", href: base, active: !onlyOurs },
            { label: "Mes matchs", href: `${base}?mes=1`, active: onlyOurs },
          ].map((o) => (
            <Link
              key={o.label}
              href={o.href}
              scroll={false}
              className={cn("rounded-full px-3 py-1 transition-colors", o.active ? "bg-panel-2 text-ink" : "text-faint hover:text-dim")}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {t.stages.map((s) => (
        <section key={s.anchor} id={s.anchor} className="scroll-mt-20 space-y-4">
          <h2 className="section-title !text-3xl">{s.title}</h2>
          {groupBlocks(s.blocks).map((chunk, i) =>
            chunk.kind === "groups" ? (
              <div key={i} className={cn("grid gap-3", chunk.tables.length > 1 && "md:grid-cols-2")}>
                {chunk.tables.map((table, j) => (
                  <GroupTableView key={j} table={table} team={team} />
                ))}
              </div>
            ) : chunk.block.kind === "bracket" ? (
              <div key={i} className="space-y-6 panel p-4">
                {chunk.block.bracket.sections.map((sec, j) => (
                  <BracketSectionView key={j} section={sec} team={team} now={now} />
                ))}
              </div>
            ) : chunk.block.kind === "matchlist" ? (
              <MatchlistView key={i} list={chunk.block.list} team={team} now={now} onlyOurs={onlyOurs} />
            ) : null,
          )}
        </section>
      ))}

      <p className="text-xs text-faint">
        Mis à jour {new Date(t.fetchedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })} ·{" "}
        <a href={source} target="_blank" rel="noopener noreferrer" className="underline hover:text-dim">
          page source
        </a>
      </p>
    </div>
  );
}

type Chunk = { kind: "groups"; tables: Extract<StageBlock, { kind: "group" }>["table"][] } | { kind: "block"; block: StageBlock };

/** Les poules consécutives s'affichent côte à côte. */
function groupBlocks(blocks: StageBlock[]): Chunk[] {
  const out: Chunk[] = [];
  for (const b of blocks) {
    const last = out.at(-1);
    if (b.kind === "group") {
      if (last?.kind === "groups") last.tables.push(b.table);
      else out.push({ kind: "groups", tables: [b.table] });
    } else out.push({ kind: "block", block: b });
  }
  return out;
}
