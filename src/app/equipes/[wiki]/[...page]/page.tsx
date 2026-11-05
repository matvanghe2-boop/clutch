import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GAME_IDS, GAMES } from "@/config/follow";
import { FormChips, FormSummary } from "@/components/form";
import { MatchRow } from "@/components/matches";
import { cn, Empty, GameTag, LiveBadge, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import {
  competitionHref,
  findTeamRef,
  formOf,
  headToHead,
  isTeam,
  matchHref,
  opponentKey,
  ordinal,
  rankOf,
  sameTeam,
  statusOf,
  teamMatches,
  teamPath,
  teamsOf,
  teamStandings,
  upcomingFeed,
} from "@/lib/derive";
import { infoDate, shortDate, shortDay, clock } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { GameId, TeamRef } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ wiki: string; page: string[] }>;

const decode = (seg: string) => {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
};

async function resolve(params: Params) {
  const { wiki, page } = await params;
  if (!GAME_IDS.includes(wiki as GameId)) return undefined;
  return { wiki: wiki as GameId, page: page.map(decode).join("/").replace(/_/g, " ") };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await resolve(params);
  return { title: r ? `${r.page} · ${GAMES[r.wiki].short}` : "Équipe" };
}

/**
 * Fiche d'une équipe que je ne suis pas : ce que Clutch sait d'elle, tiré de
 * Liquipedia. Sa page complète (effectif, derniers résultats) est lue pour les
 * adversaires des 7 prochains jours ; pour les autres, ses matchs et classements
 * dans les compétitions suivies, et ses face-à-face avec mes équipes.
 */
export default async function TeamFichePage({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { wiki, page } = r;
  const snap = await loadSnapshot();
  const self: TeamRef = { name: page, page };

  // Une équipe suivie a sa page complète.
  const followed = teamsOf(snap).find((f) => f.game === wiki && isTeam(self, f));
  if (followed) redirect(`/equipe/${followed.id}`);

  const fiche = snap.opponents?.[opponentKey(wiki, page)];
  const ref: TeamRef = findTeamRef(snap, wiki, page) ?? (fiche ? { name: fiche.name, page, logo: fiche.logo } : self);
  const now = Date.now() / 1000;
  const rank = rankOf(snap, wiki, ref);
  const ranking = snap.rankings?.[wiki];
  const form = fiche ? formOf(fiche.recent) : undefined;
  const mine = teamsOf(snap).filter((f) => f.game === wiki);
  const against = upcomingFeed(snap).filter((o) => o.match.wiki === wiki && sameTeam(o.them, ref) && statusOf(o.match, now) !== "stale");
  const h2h = mine.map((f) => ({ team: f, h2h: headToHead(snap, f, ref) })).filter((x) => x.h2h.meetings.length);
  const matches = teamMatches(snap, wiki, ref);
  const standings = teamStandings(snap, wiki, ref);
  const known = fiche || matches.length || standings.length || h2h.length || rank;

  return (
    <div data-game={wiki} className="space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_10%_0%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent)]" />
        <div className="relative flex items-center gap-5">
          <Logo team={ref} size={80} />
          <div className="min-w-0">
            <GameTag game={wiki} long />
            <h1 className="mt-2 truncate font-display text-3xl font-bold sm:text-4xl">{ref.name}</h1>
            {form && form.last.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" title="Forme du moment : les 10 derniers matchs, du plus récent au plus ancien">
                <FormChips form={form} />
                <FormSummary form={form} />
              </div>
            )}
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-dim">
              {rank && ranking && (
                <span>
                  {ordinal(rank.rank)} {wiki === "counterstrike" ? "mondial au classement Valve" : "de la saison régulière"}
                  {rank.points ? ` · ${rank.points} pts` : ""}
                </span>
              )}
              <a href={`https://liquipedia.net/${wiki}/${pageToPath(page)}`} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-dim">
                Liquipedia ↗
              </a>
            </p>
          </div>
        </div>
      </header>

      {!known && <Empty>Clutch ne connaît pas encore cette équipe : elle n&apos;apparaît dans aucune compétition suivie. Sa page Liquipedia reste à un clic.</Empty>}

      {against.length > 0 && (
        <section>
          <SectionTitle>Contre mes équipes</SectionTitle>
          <div className="space-y-2">
            {against.map((o) => (
              <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, o.team, ref)} />
            ))}
          </div>
        </section>
      )}

      {h2h.length > 0 && (
        <section>
          <SectionTitle>Face-à-face</SectionTitle>
          <div className="space-y-3">
            {h2h.map(({ team, h2h }) => (
              <div key={team.id} className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-sm">
                  <Link href={`/equipe/${team.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Logo team={{ name: team.page, logo: snap.teams[team.id]?.logo }} size={20} />
                    {team.page}
                  </Link>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    <span className="text-win">{h2h.wins}</span>
                    <span className="px-1 text-faint">–</span>
                    <span className="text-loss">{h2h.losses}</span>
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {h2h.meetings.slice(0, 8).map((x) => (
                    <div key={x.timestamp} className="grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm">
                      <span className="text-xs text-faint">{shortDate(x.timestamp, now)}</span>
                      <ResultBadge result={x.result} />
                      <span className="truncate text-xs text-faint">{x.tournament.name}</span>
                      <span className="font-display font-semibold tabular-nums">
                        {x.usScore}–{x.themScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {fiche && (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <SectionTitle>Derniers résultats</SectionTitle>
            {fiche.recent.length ? (
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {fiche.recent.map((x) => (
                  <div key={x.timestamp} className="grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="text-xs text-faint">{shortDate(x.timestamp, now)}</span>
                    <ResultBadge result={x.result} />
                    <span className="min-w-0">
                      <TeamLink snap={snap} wiki={wiki} team={x.opponent} />
                      <span className="block truncate text-xs text-faint">{x.tournament.name}</span>
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums">
                      {x.score[0]}
                      <span className="px-1 text-faint">–</span>
                      {x.score[1]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Pas de résultat récent.</Empty>
            )}
          </section>
          <section>
            <SectionTitle>Effectif</SectionTitle>
            {fiche.roster.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {fiche.roster.map((p) => (
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
                    {p.joined && <span className="w-24 shrink-0 text-right text-xs text-faint">{infoDate(p.joined, now)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Effectif non renseigné.</Empty>
            )}
          </section>
        </div>
      )}

      {!fiche && known && (
        <p className="text-xs text-faint">
          Son effectif et ses derniers résultats sont lus sur Liquipedia quand elle affronte une de mes équipes dans les 7 jours.
        </p>
      )}

      {standings.length > 0 && (
        <section>
          <SectionTitle>Classements</SectionTitle>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {standings.map((s, i) => (
              <Link key={i} href={competitionHref(wiki, s.tournament.page)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-panel-2">
                <span className="min-w-0 truncate">
                  {s.tournament.name}
                  {s.table && s.table !== "Classement" && <span className="text-faint"> · {s.table}</span>}
                </span>
                <span className="shrink-0 text-dim">
                  <b className="font-display text-base text-ink">{Number.isNaN(Number(s.row.rank)) ? s.row.rank : ordinal(Number(s.row.rank))}</b>
                  <span className="text-faint">/{s.size}</span>
                  {s.row.cells[0] && <span className="ml-2 text-faint">{s.row.cells[0]}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {matches.length > 0 && (
        <section>
          <SectionTitle>Dans les compétitions suivies</SectionTitle>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {matches.slice(0, 20).map(({ match: m, tournament }) => {
              const st = statusOf(m, now);
              const i = m.opponents.findIndex((o) => sameTeam(o, ref));
              const them = m.opponents[1 - i] ?? null;
              const ours = mine.some((f) => m.opponents.some((o) => isTeam(o, f)));
              const won = m.winner === undefined ? undefined : m.winner === i + 1;
              return (
                <div key={m.id} className={cn("grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm", ours && "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]")}>
                  <span className="text-[11px] leading-tight text-faint">
                    {st === "live" ? (
                      <LiveBadge />
                    ) : m.timestamp ? (
                      <>
                        {st === "done" ? shortDate(m.timestamp, now) : shortDay(m.timestamp, now)}
                        <br />
                        {m.timeTbd ? "heure à conf." : clock(m.timestamp)}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs text-faint">vs</span>
                      <Logo team={them} size={18} />
                      <TeamLink snap={snap} wiki={wiki} team={them} />
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {tournament.name}
                      {m.round ? ` · ${m.round}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {won !== undefined && <ResultBadge result={won ? "win" : "loss"} />}
                    {m.finished || st === "live" ? (
                      <span className="font-display text-lg font-semibold tabular-nums">
                        {m.scores[i] ?? 0}
                        <span className="px-1 text-faint">–</span>
                        {m.scores[1 - i] ?? 0}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">{m.bestOf ? `Bo${m.bestOf}` : "à venir"}</span>
                    )}
                    {ours && (
                      <Link href={matchHref(m)} className="text-xs text-[var(--accent)] hover:underline">
                        Feuille →
                      </Link>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamLink({ snap, wiki, team }: { snap: Awaited<ReturnType<typeof loadSnapshot>>; wiki: GameId; team: TeamRef | null }) {
  const href = teamPath(snap, wiki, team);
  const label = team?.name ?? "À déterminer";
  return href ? (
    <Link href={href} className="truncate hover:underline">
      {label}
    </Link>
  ) : (
    <span className="truncate">{label}</span>
  );
}
