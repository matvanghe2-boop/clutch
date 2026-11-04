import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES } from "@/config/follow";
import { MatchRow, ResultRow, TournamentCard } from "@/components/matches";
import { Empty, GameTag, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import { headToHead, opponentsRecord, recentFeed, statusOf, teamById, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { shortDate } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { loadSnapshot } from "@/lib/load-snapshot";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = teamById((await params).id);
  return { title: team ? `${team.page} · ${GAMES[team.game].short}` : "Équipe" };
}

export default async function TeamPage({ params }: { params: Params }) {
  const team = teamById((await params).id);
  if (!team) notFound();
  const snap = await loadSnapshot();
  const data = snap.teams[team.id];
  const now = Date.now() / 1000;

  const upcoming = upcomingFeed(snap).filter((o) => o.team.id === team.id && statusOf(o.match, now) !== "stale");
  const results = recentFeed(snap).filter((r) => r.team.id === team.id);
  const record = opponentsRecord(snap, team);
  const tracked = trackedTournaments(snap, now, team.game).filter((tr) => tr.team.id === team.id);
  const wins = results.filter((r) => r.result === "win").length;

  return (
    <div data-game={team.game} className="space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_10%_0%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
        <div className="relative flex items-center gap-5">
          <Logo team={{ name: team.page, logo: data?.logo }} size={80} />
          <div className="min-w-0">
            <GameTag game={team.game} long />
            <h1 className="mt-2 truncate font-display text-3xl font-bold sm:text-4xl">{team.page}</h1>
            <p className="mt-1 text-sm text-dim">
              {results.length > 0 && (
                <>
                  {wins} victoire{wins > 1 ? "s" : ""} sur les {results.length} derniers matchs ·{" "}
                </>
              )}
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
                      <span className="truncate">{opponent.name}</span>
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
