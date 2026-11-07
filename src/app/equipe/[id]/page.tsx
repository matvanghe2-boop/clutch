import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/config/follow";
import { FormChips, FormSummary } from "@/components/form";
import { MatchRow, ResultRow, TournamentCard } from "@/components/matches";
import { RankingCard } from "@/components/ranking";
import { TabsView, type Tab } from "@/components/Tabs";
import { EraMoment, EraTable, FormerRoster, GamesStats, Honors, IdentityCard, PalmaresCard, rankFigure, TeamStatistics } from "@/components/team-stats";
import { Empty, GameTag, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import { TeamHero } from "@/components/versus";
import { formOf, headToHead, historyOf, opponentsRecord, rankOf, recentFeed, statusOf, teamById, teamPath, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { lineupSince, pickEra, playedSince, rosterEras } from "@/lib/eras";
import { infoDate, shortDate, tenure } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { loadSnapshot } from "@/lib/load-snapshot";
import { accentOf } from "@/lib/team-colors";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = teamById(await loadSnapshot(), (await params).id);
  return { title: team ? `${team.page} · ${GAMES[team.game].short}` : "Équipe" };
}

/** Combien de lignes avant de replier le reste : ces deux listes faisaient à elles seules un quart de la page. */
const LIST_LIMIT = 15;

/** Une liste longue : les premières lignes, le reste à déplier. */
function Folded({ rows, limit = LIST_LIMIT }: { rows: React.ReactNode[]; limit?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden panel">
      {rows.slice(0, limit)}
      {rows.length > limit && (
        <details className="group">
          <summary className="cursor-pointer px-4 py-2.5 text-center text-xs text-faint hover:text-dim">Voir les {rows.length - limit} suivants</summary>
          <div className="divide-y divide-line border-t border-line">{rows.slice(limit)}</div>
        </details>
      )}
    </div>
  );
}

export default async function TeamPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const wanted = query.effectif;
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
  // Par défaut, les chiffres de l'équipe d'aujourd'hui : ceux du club mélangeraient des joueurs partis depuis.
  const eras = rosterEras(data?.roster ?? [], data?.stints ?? [], history);
  const era = pickEra(eras, typeof wanted === "string" ? wanted : undefined);
  const inEra = (ts: number) => !era || ((new Date(ts * 1000).toISOString().slice(0, 10) >= era.from) && (!era.to || new Date(ts * 1000).toISOString().slice(0, 10) < era.to));
  const since = lineupSince(data?.roster ?? []);

  const resultRows = results.map((r) => <ResultRow key={r.timestamp} r={r} now={now} />);
  const recordRows = record.map(({ opponent, h2h }) => {
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
  });

  const nextMatch = upcoming[0];
  const ranking = snap.rankings?.[team.game];

  const overview = (
    <>
      <IdentityCard info={data?.info} rank={rankFigure(team.game, data?.info, rankOf(snap, team.game, ownRef))} palmares={palmares} now={now} />
      <section>
        <SectionTitle aside={upcoming.length > 1 ? <button type="button" data-tab-go="matchs" className="text-xs text-faint hover:text-dim">Les {upcoming.length} matchs à venir →</button> : undefined}>Prochain match</SectionTitle>
        {nextMatch ? <MatchRow o={nextMatch} now={now} h2h={headToHead(snap, team, nextMatch.them)} /> : <Empty>Aucun match annoncé{team.game === "callofduty" ? " : la CDL est peut-être à l'intersaison" : ""}.</Empty>}
      </section>
      <div className={ranking ? "grid items-start gap-10 lg:grid-cols-2" : undefined}>
        {ranking && (
          <section>
            <SectionTitle>Classement</SectionTitle>
            <RankingCard ranking={ranking} team={team} now={now} />
          </section>
        )}
        <section>
          <SectionTitle aside={results.length > 5 ? <button type="button" data-tab-go="matchs" className="text-xs text-faint hover:text-dim">Tous les résultats →</button> : undefined}>Derniers résultats</SectionTitle>
          {results.length ? <div className="divide-y divide-line overflow-hidden panel">{resultRows.slice(0, 5)}</div> : <Empty>Pas encore de résultat.</Empty>}
        </section>
      </div>
    </>
  );

  const matches = (
    <>
      <section>
        <SectionTitle>À venir</SectionTitle>
        {upcoming.length ? (
          <div className="stagger space-y-2">
            {upcoming.map((o) => (
              <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, team, o.them)} />
            ))}
          </div>
        ) : (
          <Empty>Aucun match annoncé{team.game === "callofduty" ? " : la CDL est peut-être à l'intersaison" : ""}.</Empty>
        )}
      </section>
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Résultats</SectionTitle>
          {results.length ? <Folded rows={resultRows} /> : <Empty>Pas encore de résultat.</Empty>}
        </section>
        <section>
          <SectionTitle>Face-à-face</SectionTitle>
          {record.length ? <Folded rows={recordRows} /> : <Empty>Aucune rencontre connue.</Empty>}
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
    </>
  );

  const stats = (
    <>
      <EraMoment results={era ? era.results : history} label={era ? (era.current ? "avec l'effectif actuel" : `avec ${era.players.join(", ")}`) : "sur tout l'historique du club"} />
      <EraTable eras={eras} selected={era} total={history} palmares={palmares} base={`/equipe/${team.id}?onglet=stats`} now={now} />
      <TeamStatistics results={era ? era.results : history} scope={era ? (era.current ? "Effectif actuel" : era.players.join(", ")) : eras.length ? "Tout l'historique" : undefined} now={now} teamHref={(ref) => teamPath(snap, team.game, ref)} />
      <GamesStats samples={samples.filter((s) => inEra(s.at))} game={team.game} now={now} />
    </>
  );

  const hasHonors = Boolean(data?.awards?.length || data?.records?.length);
  const trophies = (
    <>
      {palmares && palmares.events > 0 && <PalmaresCard palmares={palmares} wiki={team.game} now={now} />}
      <Honors awards={data?.awards ?? []} records={data?.records ?? []} now={now} />
    </>
  );

  const roster = (
    <>
      {(data?.roster?.length || data?.timeline?.length) && (
        <div className="grid gap-10 lg:grid-cols-2">
          {data?.roster?.length ? (
            <section>
              <SectionTitle>Effectif</SectionTitle>
              <ul className="stagger divide-y divide-line overflow-hidden panel">
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
              <ul className="space-y-2 panel p-4 text-sm text-dim">
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
    </>
  );

  const tabs: Tab[] = [
    { id: "apercu", label: "Aperçu", panel: overview },
    { id: "matchs", label: "Matchs", badge: upcoming.length, panel: matches },
    { id: "stats", label: "Stats", panel: stats },
    ...(palmares?.events || hasHonors ? [{ id: "palmares", label: "Palmarès", badge: palmares?.titles, panel: trophies }] : []),
    { id: "effectif", label: "Effectif", panel: roster },
  ];
  const onglet = typeof query.onglet === "string" ? query.onglet : wanted ? "stats" : "apercu";

  return (
    <div data-game={team.game} style={accentOf({ name: team.page, page: team.page, logo: data?.logo })} className="space-y-10">
      <TeamHero team={{ name: team.page, page: team.page, logo: data?.logo }} game={team.game}>
        <GameTag game={team.game} long />
        <h1 className="display mt-2 break-words text-4xl sm:text-6xl">{team.page}</h1>
        {form.last.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" title="Forme du moment : les 10 derniers matchs, du plus récent au plus ancien">
            <FormChips form={form} current={playedSince(history.slice(0, form.last.length), since)} />
            <FormSummary form={form} />
          </div>
        )}
        <p className="mt-2 text-sm">
          <a href={`https://liquipedia.net/${team.game}/${pageToPath(team.page)}`} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-dim">
            Liquipedia ↗
          </a>
        </p>
      </TeamHero>

      <TabsView tabs={tabs} initial={onglet} leading={<Logo team={{ name: team.page, logo: data?.logo }} size={24} />} />
    </div>
  );
}
