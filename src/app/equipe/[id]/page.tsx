import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/config/follow";
import { FormChips, FormSummary } from "@/components/form";
import { MatchRow, ResultRow, TournamentCard } from "@/components/matches";
import { FavoriteStar } from "@/components/Favorite";
import { RankingCard } from "@/components/ranking";
import { SeasonStory, type Story } from "@/components/SeasonStory";
import { type TimePoint, TimeMachine } from "@/components/TimeMachine";
import { Later } from "@/components/Later";
import { Lineup, RosterCards } from "@/components/RosterCards";
import { TabsView, type Tab } from "@/components/Tabs";
import { EraMoment, EraTable, FormerRoster, GamesStats, Honors, IdentityCard, PalmaresCard, rankFigure, TeamStatistics } from "@/components/team-stats";
import { Empty, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import { GamePlate, TeamHero, TeamTitle } from "@/components/versus";
import { formOf, headToHead, historyOf, opponentsRecord, rankOf, recentFeed, statusOf, teamById, teamPath, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { lineupSince, pickEra, playedSince, rosterEras } from "@/lib/eras";
import { clock, dayLabel, infoDate, money, shortDate } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { isAdmin } from "@/lib/admin";
import { loadSnapshot } from "@/lib/load-snapshot";
import { rosterPhotos } from "@/lib/photos";
import { recordsOf, rivals, tally } from "@/lib/stats";
import { accentOf, largeLogo, teamColors } from "@/lib/team-colors";

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
  // Les photos des joueurs ne s'affichent que sur le navigateur déverrouillé (voir lib/photos.ts).
  const photos = rosterPhotos(snap, team.game, data?.roster ?? [], await isAdmin());
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
  const colors = teamColors({ name: team.page, page: team.page, logo: data?.logo }) ?? { a: "#4c8dff", b: "#9be15d" };

  // La saison en récit : les douze derniers mois.
  const yearAgo = now - 365 * 86400;
  const season = history.filter((r) => r.timestamp >= yearAgo);
  const seasonTally = tally(season);
  const seasonRecords = recordsOf(season);
  const victim = rivals(season, 2, 1).victims[0];
  const seasonRows = (palmares?.rows ?? []).filter((r) => r.date && Date.parse(r.date) / 1000 >= yearAgo);
  const prizeOf = (p?: string) => Number((p ?? "").replace(/[^\d]/g, "")) || 0;
  const biggest = [...seasonRows].sort((a, b) => prizeOf(b.prize) - prizeOf(a.prize))[0];
  const bestEra = eras
    .filter((e) => e.results.length >= 10)
    .map((e) => ({ e, t: tally(e.results) }))
    .sort((a, b) => b.t.rate - a.t.rate)[0];
  const story: Story | undefined =
    season.length >= 5
      ? {
          team: { name: team.page, logo: largeLogo({ name: team.page, page: team.page, logo: data?.logo }), a: colors.a, b: colors.b, game: GAMES[team.game].label },
          period: "Les douze derniers mois",
          record: { wins: seasonTally.wins, losses: seasonTally.losses, rate: Math.round(seasonTally.rate * 100) },
          titles: seasonRows.filter((r) => r.rank === 1).map((r) => r.tournament.name),
          streak: seasonRecords.bestStreak && { count: seasonRecords.bestStreak.count, dates: `du ${shortDate(seasonRecords.bestStreak.from, now)} au ${shortDate(seasonRecords.bestStreak.to, now)}` },
          victim: victim && { name: victim.opponent.name, logo: largeLogo(victim.opponent), wins: victim.tally.wins, losses: victim.tally.losses },
          best: bestEra && {
            players: bestEra.e.players.join(" · "),
            rate: Math.round(bestEra.t.rate * 100),
            wins: bestEra.t.wins,
            losses: bestEra.t.losses,
            dates: bestEra.e.current ? `depuis le ${infoDate(bestEra.e.from, now)}` : `${infoDate(bestEra.e.from, now)} → ${bestEra.e.to ? infoDate(bestEra.e.to, now) : ""}`,
          },
          prize: biggest && prizeOf(biggest.prize) > 0 ? { name: biggest.tournament.name, amount: money(biggest.prize) ?? biggest.prize ?? "" } : undefined,
          next: nextMatch?.them
            ? { them: nextMatch.them.name, logo: largeLogo(nextMatch.them), when: nextMatch.match.timestamp ? `${dayLabel(nextMatch.match.timestamp, now)}${nextMatch.match.timeTbd ? "" : ` à ${clock(nextMatch.match.timestamp)}`}` : "horaire à venir" }
            : undefined,
        }
      : undefined;

  // Remonter le temps : les matchs de l'effectif choisi, du plus ancien au plus récent.
  const timeline: TimePoint[] = [...(era ? era.results : history)]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({ t: r.timestamp, r: r.result, o: r.opponent?.name, lg: r.opponent?.logo, tn: r.tournament.name }));
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
      {timeline.length >= 5 && (
        <section>
          <SectionTitle aside={<span className="text-xs text-faint">fais glisser, ou rejoue la saison</span>}>Remonter le temps</SectionTitle>
          <TimeMachine points={timeline} />
        </section>
      )}
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
      {data?.roster?.length ? (
        <section>
          <SectionTitle>Effectif</SectionTitle>
          <RosterCards players={data.roster} team={{ name: team.page, page: team.page, logo: data.logo }} now={now} photos={photos} />
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
  // L'onglet demandé part en premier ; les autres suivent dans la même réponse.
  const opened = tabs.some((t) => t.id === onglet) ? onglet : tabs[0].id;
  for (const t of tabs) if (t.id !== opened) t.panel = <Later>{t.panel}</Later>;

  return (
    <div data-game={team.game} style={accentOf({ name: team.page, page: team.page, logo: data?.logo })} className="space-y-10">
      <TeamHero team={{ name: team.page, page: team.page, logo: data?.logo }} game={team.game} aside={Object.keys(photos).length ? <Lineup players={data?.roster ?? []} photos={photos} /> : undefined}>
        <TeamTitle name={team.page} game={team.game} />
        {form.last.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" title="Forme du moment : les 10 derniers matchs, du plus récent au plus ancien">
            <FormChips form={form} current={playedSince(history.slice(0, form.last.length), since)} />
            <FormSummary form={form} />
          </div>
        )}
        <div className="hero-actions">
          {story && <SeasonStory story={story} />}
          <FavoriteStar id={team.id} a={colors.a} b={colors.b} name={team.page} />
          <a href={`https://liquipedia.net/${team.game}/${pageToPath(team.page)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-faint hover:text-dim">
            Liquipedia ↗
          </a>
        </div>
      </TeamHero>

      <TabsView tabs={tabs} initial={onglet} leading={
          <>
            <Logo team={{ name: team.page, logo: data?.logo }} size={24} />
            <GamePlate game={team.game} short />
          </>
        } />
    </div>
  );
}
