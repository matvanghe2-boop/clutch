import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CountdownCells } from "@/components/Countdown";
import { MatchDock } from "@/components/MatchDock";
import { matchNotes, NoteTags } from "@/components/matches";
import { ExactMoment, LiveScore, VictoryMoment } from "@/components/Moments";
import { PronoReveal } from "@/components/PronoReveal";
import { Portrait } from "@/components/Portrait";
import { ReplayVs } from "@/components/ReplayVs";
import { FaceRow } from "@/components/RosterCards";
import { ScorePicker } from "@/components/ScorePicker";
import { FormChips, FormSummary } from "@/components/form";
import { StreamPlayer } from "@/components/StreamPlayer";
import { Duel, rankFigure } from "@/components/team-stats";
import { Versus } from "@/components/versus";
import { cn, Empty, GameTag, LiveBadge, Logo, Num, ResultBadge, SectionTitle, StreamLinks } from "@/components/ui";
import { predict } from "@/app/actions";
import { isAdmin } from "@/lib/admin";
import { competitionHref, findMatch, type Form, formOf, headToHead, historyOf, matchHref, type MatchStatus, opponentKey, ordinal, predictionResult, rankOf, statusOf, teamPath, undatedId } from "@/lib/derive";
import { lineupSince, playedSince } from "@/lib/eras";
import { clock, dayLabel, shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { rosterPhotos } from "@/lib/photos";
import { loadPredictions } from "@/lib/prediction-store";
import { revealedIds } from "@/lib/reveal-store";
import { findPick, judge, possibleScores, type Prediction } from "@/lib/predictions";
import { embeddable, matchStreams } from "@/lib/streams";
import { accentOf, duelVars, largeLogo, teamColors } from "@/lib/team-colors";
import type { PlayerPhoto, RankingRow, RosterEntry, TeamRef } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const decode = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = findMatch(await loadSnapshot(), decode((await params).id));
  return { title: found ? `${found.o.us.short ?? found.o.us.name} – ${found.o.them?.name ?? "à déterminer"}` : "Match" };
}

/** Le lecteur apparaît une heure avant le début, et reste pendant le match. */
const PLAYER_LEAD_S = 3600;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MatchPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const snap = await loadSnapshot();
  const id = decode((await params).id);
  const found = findMatch(snap, id);
  if (!found) notFound();
  const { o, tournament } = found;
  const m = o.match;
  // Le match a reçu son horaire depuis ce lien : on rejoint son adresse définitive.
  if (id.includes(":nodate:") && m.id !== id) redirect(matchHref(m));
  const prono = (await searchParams).prono;
  const [predictions, admin, revealed] = await Promise.all([loadPredictions(), isAdmin(), revealedIds()]);
  // Le même match peut avoir été pronostiqué sous un autre identifiant (page de la compétition, horaire changé).
  const prediction = findPick(predictions, { wiki: m.wiki, teamId: o.team.id, opponent: { name: o.them?.name ?? "", page: o.them?.page }, timestamp: m.timestamp }, [id, m.id, undatedId(m)]);
  const now = Date.now() / 1000;
  const st = statusOf(m, now);
  const note = st === "upcoming" ? (await matchNotes()).get(m.id) : undefined;

  const streams = matchStreams(o.team, m.streams);
  const players = embeddable(streams, (await headers()).get("host") ?? "localhost");
  const soon = st === "upcoming" && m.timestamp !== undefined && !m.timeTbd && m.timestamp - now < PLAYER_LEAD_S;
  const showPlayer = players.length > 0 && (st === "live" || soon);

  // Manches vues de l'équipe suivie : elle est à gauche, même si la compétition la place à droite.
  const reversed = m.opponents[1] === o.us;
  const games = m.games.map((g) => ({
    map: g.map,
    us: reversed ? g.score2 : g.score1,
    them: reversed ? g.score1 : g.score2,
    won: g.winner === undefined ? undefined : g.winner === (reversed ? 2 : 1),
  }));

  // Le fil de la série, si les manches connues racontent bien le score final.
  const decided = games.flatMap((g) => (g.won === undefined ? [] : [g.won ? ("a" as const) : ("b" as const)]));
  const story = st === "done" && decided.filter((w) => w === "a").length === Number(o.usScore) && decided.filter((w) => w === "b").length === Number(o.themScore) ? decided : undefined;

  const h2h = headToHead(snap, o.team, o.them);
  const opp = o.them?.page ? snap.opponents?.[opponentKey(m.wiki, o.them.page)] : undefined;
  const usHistory = historyOf(snap, o.team);
  const usForm = formOf(usHistory);
  const themForm = opp ? formOf(opp.recent) : undefined;
  const usRoster = snap.teams[o.team.id]?.roster ?? [];
  const themRoster = opp?.roster ?? [];
  const usPhotos = rosterPhotos(snap, m.wiki, usRoster, admin);
  const themPhotos = rosterPhotos(snap, m.wiki, themRoster, admin);
  const usSince = lineupSince(usRoster);
  const themSince = lineupSince(themRoster);
  const t = m.tournament;
  // Pourquoi la fiche de l'adversaire manque : il n'est pas encore connu, le match est passé, ou Liquipedia n'a pas de page pour lui.
  const noPage = o.them?.page && /missingtitle|doesn.t exist/.test(snap.failures[`opponent:${opponentKey(m.wiki, o.them.page)}`]?.message ?? "");
  const opponentNote = !o.them
    ? "Adversaire à déterminer."
    : noPage
      ? "Pas de page Liquipedia pour cette équipe."
      : st === "done"
        ? "Seuls les adversaires des 7 prochains jours sont suivis."
        : "Sa fiche arrive avec la prochaine synchro.";

  return (
    <div data-game={m.wiki} style={duelVars(o.us, o.them)} className="space-y-10">
      <h1 className="sr-only">
        {o.us.name} contre {o.them?.name ?? "un adversaire à déterminer"}
        {t?.name ? `, ${t.name}` : ""}
      </h1>
      <Versus
        game={m.wiki}
        live={st === "live"}
        outcome={st === "done" ? (o.result ?? undefined) : undefined}
        dock={<MatchDock us={o.us} them={o.them} mid={st === "done" || st === "live" ? `${o.usScore ?? 0} – ${o.themScore ?? 0}` : m.timestamp && !m.timeTbd ? clock(m.timestamp) : "—"} />}
        us={o.us}
        them={o.them}
        usHref={teamPath(snap, m.wiki, o.us)}
        themHref={teamPath(snap, m.wiki, o.them)}
        lineups={[
          <FaceRow key="a" players={usRoster} photos={usPhotos} label={`La ligne de ${o.us.name}`} />,
          <FaceRow key="b" players={themRoster} photos={themPhotos} label={`La ligne de ${o.them?.name ?? "l'adversaire"}`} />,
        ]}
        dimUs={st === "done" && o.result === "loss"}
        dimThem={st === "done" && o.result === "win"}
        top={
          <>
            <div className="flex min-w-0 items-center gap-2 text-dim">
              <GameTag game={m.wiki} />
              {t?.page ? (
                <Link href={competitionHref(m.wiki, t.page, t.anchor)} className="truncate hover:text-ink">
                  {[t.name, m.round ?? t.stage].filter(Boolean).join(" · ")}
                </Link>
              ) : (
                <span className="truncate">{t?.name}</span>
              )}
            </div>
            {st === "live" ? <LiveBadge /> : <span className="display shrink-0 text-sm tracking-[0.14em] text-faint">{st === "done" ? "Terminé" : "À venir"}</span>}
          </>
        }
        center={
          st === "done" || st === "live" ? (
            <>
              <LiveScore us={o.usScore ?? 0} them={o.themScore ?? 0} dimUs={st === "done" && o.result !== "win"} dimThem={st === "done" && o.result !== "loss"} bestOf={m.bestOf} story={story} storyKey={`clutch:serie:${m.id}`} />
              {st === "done" && m.timestamp && <div className="mt-2 text-sm text-dim">{dayLabel(m.timestamp, now)}</div>}
              {st === "done" && o.result === "win" && <VictoryMoment id={m.id} games={story?.length} />}
            </>
          ) : m.timestamp && m.timeTbd ? (
            <>
              <div className="display text-3xl sm:text-5xl">{dayLabel(m.timestamp, now)}</div>
              <div className="mt-2 text-sm text-dim">Heure à confirmer</div>
            </>
          ) : m.timestamp ? (
            <>
              <div className="arena-time">
                <div className="score text-5xl sm:text-6xl lg:text-8xl">{clock(m.timestamp)}</div>
                <div className="mt-2 text-sm text-dim">{dayLabel(m.timestamp, now)}</div>
              </div>
              <NoteTags note={note} now={now} className="mt-2 justify-center" />
              <div className="mt-3">
                <CountdownCells ts={m.timestamp} initialNow={now} />
              </div>
            </>
          ) : (
            <div className="display text-2xl text-dim sm:text-4xl">Horaire à venir</div>
          )
        }
        bottom={
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-dim">
              {m.bestOf && <span className="display text-base text-ink">Bo{m.bestOf}</span>}
              {h2h.meetings.length > 0 ? (
                <span className="text-faint">
                  Face-à-face <b className="font-semibold text-win">{h2h.wins}</b>–<b className="font-semibold text-loss">{h2h.losses}</b>
                </span>
              ) : (
                <span className="text-faint">Première rencontre connue</span>
              )}
            </div>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <ReplayVs game={m.wiki} />
              {tournament && (
                <Link href={competitionHref(m.wiki, tournament.page, t?.anchor)} className="text-faint hover:text-dim">
                  Voir dans la compétition →
                </Link>
              )}
            </span>
          </>
        }
      />

      {streams.length > 0 && st !== "done" && (
        <section id="regarder" className="scroll-mt-24">
          <SectionTitle>Regarder</SectionTitle>
          {showPlayer ? (
            <StreamPlayer
              streams={players}
              board={{
                id: m.id,
                us: { name: o.us.short ?? o.us.name, logo: largeLogo(o.us), color: teamColors(o.us)?.a },
                them: { name: o.them?.short ?? o.them?.name ?? "?", logo: o.them ? largeLogo(o.them) : undefined, color: o.them ? teamColors(o.them)?.a : undefined },
                score: st === "live" ? `${o.usScore ?? 0} – ${o.themScore ?? 0}` : m.timestamp ? clock(m.timestamp) : "VS",
                live: st === "live",
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 panel px-4 py-3 text-sm text-dim">
              <span>{players.length ? "Le lecteur s'affiche ici une heure avant le début du match." : "Les streams du match :"}</span>
              <StreamLinks streams={streams} max={8} />
            </div>
          )}
        </section>
      )}

      {games.length > 0 && (
        <section>
          <SectionTitle>Manches</SectionTitle>
          <ol className="divide-y divide-line overflow-hidden panel">
            {games.map((g, i) => (
              <li
                key={i}
                className={cn(
                  "row-hover grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-l-2 px-4 py-2.5 text-sm",
                  g.won === true ? "border-l-win/70" : g.won === false ? "border-l-loss/70" : "border-l-transparent",
                )}
              >
                <span className="text-xs text-faint">Manche {i + 1}</span>
                <span className="truncate">{g.map ?? "—"}</span>
                <span className="flex items-center gap-3">
                  {g.won === undefined ? (
                    st === "live" && <span className="text-xs text-live">en cours</span>
                  ) : (
                    <ResultBadge result={g.won ? "win" : "loss"} />
                  )}
                  <span className="score w-16 text-right text-2xl">
                    <span className={g.won === false ? "text-dim" : undefined}>{g.us ?? "–"}</span>
                    <span className="px-1 text-faint">–</span>
                    <span className={g.won === true ? "text-dim" : undefined}>{g.them ?? "–"}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(st === "upcoming" || prediction) && (
        <PredictionPanel
          id={id}
          status={st}
          bestOf={m.bestOf}
          prediction={prediction}
          result={prediction ? predictionResult(snap, id, prediction) : undefined}
          admin={admin}
          message={typeof prono === "string" ? prono : undefined}
          covered={st === "done" && m.timestamp !== undefined && now - m.timestamp < 4 * 86400 && !revealed.has(id)}
          usName={o.us.short ?? o.us.name}
          themName={o.them?.short ?? o.them?.name ?? "?"}
        />
      )}

      <Duel
        us={{ team: o.us, info: snap.teams[o.team.id]?.info, rank: rankFigure(m.wiki, snap.teams[o.team.id]?.info, rankOf(snap, m.wiki, o.us)), form: usForm, since: usSince, results: usHistory, now }}
        them={{ team: o.them, info: opp?.info, rank: rankFigure(m.wiki, opp?.info, rankOf(snap, m.wiki, o.them)), form: themForm, since: themSince, results: opp?.recent, partial: true, now }}
      />

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Forme du moment</SectionTitle>
          <div className="divide-y divide-line overflow-hidden panel">
            <FormRow team={o.us} form={usForm} current={playedSince(usHistory.slice(0, usForm.last.length), usSince)} rank={rankOf(snap, m.wiki, o.us)} rankLabel={snap.rankings?.[m.wiki]?.wiki === "counterstrike" ? "VRS" : "saison"} />
            <FormRow team={o.them} form={themForm} current={playedSince((opp?.recent ?? []).slice(0, themForm?.last.length ?? 0), themSince)} rank={rankOf(snap, m.wiki, o.them)} rankLabel={snap.rankings?.[m.wiki]?.wiki === "counterstrike" ? "VRS" : "saison"} missing={opponentNote} />
          </div>
        </section>

        <section>
          <SectionTitle>Face-à-face</SectionTitle>
          {h2h.meetings.length ? (
            <div className="divide-y divide-line overflow-hidden panel">
              {h2h.meetings.slice(0, 10).map((r) => (
                <div key={r.timestamp} className="grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="text-xs text-faint">{shortDate(r.timestamp, now)}</span>
                  <ResultBadge result={r.result} />
                  <span className="truncate text-xs text-faint">{r.tournament.name}</span>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {r.usScore}
                    <span className="px-1 text-faint">–</span>
                    {r.themScore}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Aucune rencontre connue entre les deux équipes.</Empty>
          )}
        </section>
      </div>

      {(usRoster.length > 0 || themRoster.length > 0) && (
        <section>
          <SectionTitle>Effectifs</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Roster team={o.us} players={usRoster} photos={usPhotos} />
            <Roster team={o.them} players={themRoster} photos={themPhotos} />
          </div>
        </section>
      )}
    </div>
  );
}

function FormRow({ team, form, missing, rank, rankLabel, current }: { team: TeamRef | null; form?: Form; missing?: string; rank?: RankingRow; rankLabel: string; current?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="flex min-w-36 flex-1 items-center gap-2">
        <Logo team={team} size={22} />
        <span className="truncate font-medium">{team?.name ?? "À déterminer"}</span>
        {rank && (
          <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-dim" title={rank.points ? `${rank.points} points` : undefined}>
            {ordinal(rank.rank)} {rankLabel}
          </span>
        )}
      </span>
      {form?.last.length ? (
        <span className="flex flex-col items-end gap-1">
          <FormChips form={form} size="sm" current={current} />
          <FormSummary form={form} />
        </span>
      ) : (
        <span className="text-xs text-faint">{missing ?? "Pas encore de résultat connu."}</span>
      )}
    </div>
  );
}

/** Un effectif, avec les portraits des joueurs sur le navigateur déverrouillé (voir lib/photos.ts). */
function Roster({ team, players, photos }: { team: TeamRef | null; players: RosterEntry[]; photos: Record<string, PlayerPhoto> }) {
  return (
    <div className="overflow-hidden panel" style={team ? accentOf(team) : undefined}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-medium">
        <Logo team={team} size={20} />
        <span className="truncate">{team?.name ?? "À déterminer"}</span>
      </div>
      {players.length ? (
        <ul className="divide-y divide-line">
          {players.map((p) => (
            <li key={p.id} className={cn("flex gap-2 px-4 py-2 text-sm", Object.keys(photos).length ? "items-center" : "items-baseline")}>
              {photos[p.id] ? (
                <Portrait photo={photos[p.id]} className="roster-face" />
              ) : Object.keys(photos).length > 0 ? (
                // Sans photo dans un effectif qui en a : une pastille à l'initiale garde les noms alignés.
                <span className="roster-face roster-face-empty" aria-hidden>
                  {p.id.slice(0, 1)}
                </span>
              ) : null}
              <span className="font-medium">{p.id}</span>
              {p.captain && <span className="text-[var(--accent)]" title="Capitaine">©</span>}
              {p.name && <span className="truncate text-xs text-faint">{p.name}</span>}
              {p.role && <span className="ml-auto shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-dim">{p.role}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-faint">Effectif pas encore connu.</p>
      )}
    </div>
  );
}

const PRONO_MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  enregistre: { text: "Pronostic enregistré.", ok: true },
  verrouille: { text: "Déverrouille d'abord les réglages avec ton code pour pronostiquer." },
  commence: { text: "Trop tard : le match a commencé." },
  invalide: { text: "Ce score n'est pas possible dans ce format." },
};

function PredictionPanel({
  id,
  status,
  bestOf,
  prediction,
  result,
  admin,
  message,
  usName,
  themName,
  covered,
}: {
  covered?: boolean;
  id: string;
  status: MatchStatus;
  bestOf?: number;
  prediction?: Prediction;
  result?: { us: number; them: number };
  admin: boolean;
  message?: string;
  usName: string;
  themName: string;
}) {
  const open = status === "upcoming";
  const verdict = prediction && result ? judge(prediction, result) : undefined;
  const scores = possibleScores(bestOf);
  const note = message ? PRONO_MESSAGES[message] : undefined;
  return (
    <section id="pronostic" className="scroll-mt-24">
      <SectionTitle aside={<Link href="/pronostics" className="text-xs text-faint hover:text-dim">Mes pronostics →</Link>}>Pronostic</SectionTitle>
      <div className="relative space-y-4 overflow-hidden panel p-4">
        {message === "enregistre" && (
          <span className="prono-stamp display" aria-hidden>
            Validé
          </span>
        )}
        {note && <p className={cn("text-sm", note.ok ? "text-win" : "text-loss")}>{note.text}</p>}
        {prediction ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-dim">
              Ton pronostic : {usName}{" "}
              <b className="score text-2xl text-ink">
                <Num value={prediction.us} />–<Num value={prediction.them} />
              </b>{" "}
              {themName}
            </span>
            {verdict ? (
              <PronoReveal id={id} covered={Boolean(covered)} verdict={verdict}>
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", verdict.points === 3 ? "bg-win/15 text-win" : verdict.points === 1 ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : "bg-loss/15 text-loss")}>
                {verdict.exact ? "Score exact · +3" : verdict.winner ? "Bon vainqueur · +1" : "Raté · 0"}
                {verdict.exact && <ExactMoment id={id} />}
              </span>
              </PronoReveal>
            ) : (
              !open && <span className="text-xs text-faint">en attente du résultat</span>
            )}
          </div>
        ) : (
          open && <p className="text-sm text-dim">Ton score pour ce match ? Modifiable jusqu&apos;au coup d&apos;envoi.</p>
        )}
        {open &&
          (admin ? (
            scores ? (
              <ScorePicker id={id} scores={scores} initial={prediction ? [prediction.us, prediction.them] : undefined} usName={usName} themName={themName} />
            ) : (
              <form action={predict} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={id} />
                <input name="us" type="number" min={0} max={20} required defaultValue={prediction?.us} aria-label={usName} className="w-16 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center" />
                <span className="text-faint">–</span>
                <input name="them" type="number" min={0} max={20} required defaultValue={prediction?.them} aria-label={themName} className="w-16 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center" />
                <button className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-bg hover:opacity-90">Valider</button>
              </form>
            )
          ) : (
            <p className="text-xs text-faint">
              Pour pronostiquer, <Link href="/reglages" className="underline hover:text-dim">déverrouille les réglages</Link> avec ton code.
            </p>
          ))}
      </div>
    </section>
  );
}
