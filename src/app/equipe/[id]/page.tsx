import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/config/follow";
import { FormChips, FormSummary } from "@/components/form";
import { MatchRow, ResultRow, TournamentCard } from "@/components/matches";
import { RankingCard } from "@/components/ranking";
import { FormerRoster, GamesStats, Honors, IdentityCard, PalmaresCard, rankFigure, TeamStatistics } from "@/components/team-stats";
import { Empty, GameTag, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import { formOf, headToHead, historyOf, opponentsRecord, rankOf, recentFeed, statusOf, teamById, teamPath, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { infoDate, shortDate, tenure } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { loadSnapshot } from "@/lib/load-snapshot";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = teamById(await loadSnapshot(), (await params).id);
  return { title: team ? `${team.page} · ${GAMES[team.game].short}` : "Équipe" };
}

export default async function TeamPage({ params }: { params: Params }) {
  const snap = await loadSnapshot();
  const team = teamById(snap, (await params).id);
  if (!team) notFound();
  const data = snap.teams[team.id];
  const now = Date.now() / 1000;

  const upcoming = upcomingFeed(snap).filter((o) => o.team.id === team.id && statusOf(o.match, now) !== "stale");
  const results = recentFeed(snap).filter((r) => r.team.id === team.id);
  const record = opponentsRecord(snap, team);
  const tracked = trackedTournaments(snap, now, team.game).filter((tr) => tr.team.id === team.id);
  const history = historyOf(snap, team);
  const form = formOf(history);
  const palmares = snap.palmares?.[team.id];
  const samples = Object.values(snap.games?.[team.id] ?? {}).flat();
  const ownRef = { name: team.page, page: team.page };

  return (
    <div data-game={team.game} className="space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_10%_0%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
        <div className="relative flex items-center gap-5">
          <Logo team={{ name: team.page, logo: data?.logo }} size={80} />
          <div className="min-w-0">
            <GameTag game={team.game} long />
            <h1 className="mt-2 truncate font-display text-3xl font-bold sm:text-4xl">{team.page}</h1>
            {form.last.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" title="Forme du moment : les 10 derniers matchs, du plus récent au plus ancien">
                <FormChips form={form} />
                <FormSummary form={form} />
              </div>
            )}
            <p className="mt-1.5 text-sm text-dim">
              <a
                href={`https://liquipedia.net/${team.game}/${pageToPath(team.page)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-faint hover:text-dim"
              >
                Liquipedia ↗
              </a>
            </p>
          </div>
        </div>
      </header>

      <IdentityCard info={data?.info} rank={rankFigure(team.game, data?.info, rankOf(snap, team.game, ownRef))} palmares={palmares} now={now} />

      <section>
        <SectionTitle>À venir</SectionTitle>
        {upcoming.length ? (
          <div className="space-y-2">
            {upcoming.map((o) => (
              <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, team, o.them)} />
            ))}
          </div>
        ) : (
          <Empty>Aucun match annoncé{team.game === "callofduty" ? " : la CDL est peut-être à l'intersaison" : ""}.</Empty>
        )}
      </section>

      {snap.rankings?.[team.game] && (
        <section>
          <SectionTitle>Classement</SectionTitle>
          <RankingCard ranking={snap.rankings[team.game]!} team={team} now={now} />
        </section>
      )}

      <TeamStatistics results={history} now={now} teamHref={(ref) => teamPath(snap, team.game, ref)} />

      <GamesStats samples={samples} game={team.game} now={now} />

      {palmares && palmares.events > 0 && <PalmaresCard palmares={palmares} wiki={team.game} now={now} />}

      {(data?.roster?.length || data?.timeline?.length) && (
        <div className="grid gap-10 lg:grid-cols-2">
          {data?.roster?.length ? (
            <section>
              <SectionTitle>Effectif</SectionTitle>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {data.roster.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.id}</span>
                      {p.captain && (
                        <span className="ml-1.5 text-[var(--accent)]" title="Capitaine">
                          ©
                        </span>
                      )}
                      {p.name && <span className="ml-2 text-faint">{p.name}</span>}
                    </span>
                    {p.role && <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-dim">{p.role}</span>}
                    <span className="hidden w-28 shrink-0 text-right text-xs text-faint sm:block">{p.country}</span>
                    {p.joined && (
                      <span className="w-24 shrink-0 text-right text-xs text-faint" title={`Arrivée dans l'équipe : ${infoDate(p.joined, now)}`}>
                        {tenure(p.joined, undefined, now) ?? infoDate(p.joined, now)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data?.timeline?.length ? (
            <section>
              <SectionTitle>Derniers mouvements</SectionTitle>
              <ul className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm text-dim">
                {data.timeline.map((line, i) => (
                  <li key={i} className="border-l-2 border-[color-mix(in_srgb,var(--accent)_50%,transparent)] pl-3 leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <FormerRoster players={data?.former ?? []} now={now} />

      <Honors awards={data?.awards ?? []} records={data?.records ?? []} now={now} />

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Résultats</SectionTitle>
          {results.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {results.map((r) => (
                <ResultRow key={r.timestamp} r={r} now={now} />
              ))}
            </div>
          ) : (
            <Empty>Pas encore de résultat.</Empty>
          )}
        </section>

        <section>
          <SectionTitle>Face-à-face</SectionTitle>
          {record.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {record.map(({ opponent, h2h }) => {
                const last = h2h.meetings[0];
                return (
                  <div key={opponent.page ?? opponent.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 sm:px-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <Logo team={opponent} size={20} />
                      {teamPath(snap, team.game, opponent) ? (
                        <Link href={teamPath(snap, team.game, opponent)!} className="truncate hover:underline">
                          {opponent.name}
                        </Link>
                      ) : (
                        <span className="truncate">{opponent.name}</span>
                      )}
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums">
                      <span className="text-win">{h2h.wins}</span>
                      <span className="px-1 text-faint">–</span>
                      <span className="text-loss">{h2h.losses}</span>
                    </span>
                    {last && (
                      <span className="flex w-24 items-center justify-end gap-2 text-xs text-faint">
                        {shortDate(last.timestamp, now)}
                        <ResultBadge result={last.result} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>Aucune rencontre connue.</Empty>
          )}
        </section>
      </div>

      {tracked.length > 0 && (
        <section>
          <SectionTitle>Compétitions</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {tracked.map((tr) => (
              <TournamentCard key={tr.tournament.key} tr={tr} now={now} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
