import Link from "next/link";
import { GAME_IDS, GAMES } from "@/config/follow";
import { MatchRow, NextMatch, ResultRow, TournamentCard } from "@/components/matches";
import { Arrange, type Block } from "@/components/Arrange";
import { FormChips } from "@/components/form";
import { Pills } from "@/components/Pills";
import { SinceVisit } from "@/components/SinceVisit";
import { Empty, Logo, ResultBadge, SectionTitle } from "@/components/ui";
import { formOf, type HeadToHead, headToHead, historyOf, opponentKey, type Oriented, recentFeed, statusOf, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { ORDER_COOKIE, parseOrder } from "@/lib/home-order";
import { cookies } from "next/headers";
import { clock, dayKey, dayLabel } from "@/lib/format";
import { readHidden } from "@/lib/hidden";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { Snapshot } from "@/lib/types";
import { type Evening, eveningOf } from "@/lib/tonight";
import type { GameId } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseGame(v: string | string[] | undefined): GameId | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return GAME_IDS.find((g) => g === s || GAMES[g].short.toLowerCase() === s?.toLowerCase());
}

/** Le dos d'une carte de match : le face-à-face, puis la forme des deux équipes. */
function RowBack({ snap, o, h2h }: { snap: Snapshot; o: Oriented; h2h: HeadToHead }) {
  const usForm = formOf(historyOf(snap, o.team));
  const fiche = o.them?.page ? snap.opponents?.[opponentKey(o.match.wiki, o.them.page)] : undefined;
  const themForm = fiche ? formOf(fiche.recent) : undefined;
  return (
    <div className="row-back">
      <div className="row-back-h2h">
        <span className="text-xs text-faint">Face-à-face</span>
        {h2h.meetings.length ? (
          <>
            <b className="score text-2xl">
              <span className="text-win">{h2h.wins}</span>
              <span className="px-1 text-faint">–</span>
              <span className="text-loss">{h2h.losses}</span>
            </b>
            <span className="flex gap-1">
              {h2h.meetings.slice(0, 5).map((m) => (
                <ResultBadge key={m.timestamp} result={m.result} />
              ))}
            </span>
          </>
        ) : (
          <span className="text-sm text-dim">première rencontre</span>
        )}
      </div>
      <div className="row-back-forms">
        <span className="flex items-center gap-2">
          <Logo team={o.us} size={18} />
          {usForm.last.length ? <FormChips form={usForm} size="sm" /> : <span className="text-xs text-faint">forme inconnue</span>}
        </span>
        <span className="flex items-center gap-2">
          <Logo team={o.them} size={18} />
          {themForm?.last.length ? <FormChips form={themForm} size="sm" /> : <span className="text-xs text-faint">forme inconnue</span>}
        </span>
      </div>
    </div>
  );
}

/** Le lien vers la vue du soir, quand mes équipes jouent ce soir. */
function TonightBanner({ evening, now }: { evening: Evening; now: number }) {
  if (!evening.tonight || !evening.matches.length) return null;
  const [first, ...others] = evening.matches;
  const live = statusOf(first.match, now) === "live";
  return (
    <Link href="/ce-soir" data-game={first.match.wiki} className={`panel lift sheen relative flex items-center gap-3 overflow-hidden border-[color-mix(in_srgb,var(--accent)_45%,transparent)] px-4 py-3 ${live ? "live-ring" : ""}`}>
      <span className="display text-xl text-[var(--accent)]">Ce soir</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {live ? "En direct" : first.match.timeTbd || !first.match.timestamp ? "Heure à confirmer" : clock(first.match.timestamp)} · {first.us.short ?? first.us.name} contre {first.them?.short ?? first.them?.name ?? "à déterminer"}
        {others.length > 0 && <span className="text-faint"> · et {others.length} autre{others.length > 1 ? "s" : ""}</span>}
      </span>
      <span className="shrink-0 text-faint">→</span>
    </Link>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const game = parseGame((await searchParams).jeu);
  const snap = await loadSnapshot();
  const now = Date.now() / 1000;

  if (!snap.updatedAt) {
    return (
      <Empty>
        Aucune donnée pour l&apos;instant. Lance <code className="text-dim">npm run sync</code> (ou{" "}
        <code className="text-dim">npm run dev</code>, qui synchronise en continu) : la première passe prend quelques
        minutes, Liquipedia n&apos;autorisant qu&apos;une page toutes les 30 secondes.
      </Empty>
    );
  }

  const upcoming = upcomingFeed(snap, game).filter((o) => statusOf(o.match, now) !== "stale");
  const [hero, ...rest] = upcoming;
  const results = recentFeed(snap, game).slice(0, 10);
  const hidden = await readHidden();
  const tracked = trackedTournaments(snap, now, game).filter((tr) => !hidden.has(tr.tournament.key));

  const evening = eveningOf(snap, now);
  const days = new Map<string, typeof rest>();
  for (const o of rest) {
    const key = o.match.timestamp ? dayKey(o.match.timestamp) : "zz";
    days.set(key, [...(days.get(key) ?? []), o]);
  }

  const order = parseOrder((await cookies()).get(ORDER_COOKIE)?.value);
  const blocks: Block[] = [
    ...(!game && evening.tonight && evening.matches.length ? [{ id: "ce-soir", label: "Ce soir", node: <TonightBanner evening={evening} now={now} /> }] : []),
    {
      id: "prochain",
      label: "Prochain match",
      node: hero ? <NextMatch o={hero} now={now} h2h={headToHead(snap, hero.team, hero.them)} /> : <Empty>Aucun match annoncé pour {game ? GAMES[game].label : "tes équipes"} pour le moment.</Empty>,
    },
    ...(rest.length > 0
      ? [
          {
            id: "programme",
            label: "Au programme",
            node: (
              <section>
                <SectionTitle
                  aside={
                    <Link href="/calendrier" className="text-xs text-faint hover:text-dim">
                      Tout le calendrier →
                    </Link>
                  }
                >
                  Au programme
                </SectionTitle>
                <div className="space-y-6">
                  {[...days.entries()].map(([key, list]) => (
                    <div key={key}>
                      <h3 className="display mb-2 text-base tracking-wide text-dim">{list[0].match.timestamp ? dayLabel(list[0].match.timestamp, now) : "Date à confirmer"}</h3>
                      <div className="stagger space-y-2">
                        {list.map((o) => {
                          const h2h = headToHead(snap, o.team, o.them);
                          return <MatchRow key={o.match.id} o={o} now={now} h2h={h2h} back={<RowBack snap={snap} o={o} h2h={h2h} />} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ),
          },
        ]
      : []),
    {
      id: "resultats",
      label: "Résultats et compétitions",
      node: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <section>
            <SectionTitle>Derniers résultats</SectionTitle>
            {results.length ? (
              <div className="divide-y divide-line overflow-hidden panel">
                {results.map((r) => (
                  <ResultRow key={`${r.team.id}-${r.timestamp}`} r={r} now={now} showGame={!game} />
                ))}
              </div>
            ) : (
              <Empty>Pas encore de résultat.</Empty>
            )}
          </section>
          <section>
            <SectionTitle>Compétitions suivies</SectionTitle>
            {tracked.length ? (
              <div className="grid gap-3">
                {tracked.map((tr) => (
                  <TournamentCard key={tr.tournament.key} tr={tr} now={now} />
                ))}
              </div>
            ) : (
              <Empty>Aucune compétition en cours ou récente.</Empty>
            )}
          </section>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {/* Le titre de la page, pour la lecture à voix haute : l'affiche du prochain match en tient lieu à l'écran. */}
      <h1 className="sr-only">Clutch : les matchs de mes équipes{game ? `, ${GAMES[game].label}` : ""}</h1>
      {!game && <SinceVisit now={now} />}
      <Pills skew label="Filtrer par jeu">
        {[undefined, ...GAME_IDS].map((g) => (
          <Link key={g ?? "all"} href={g ? `/?jeu=${GAMES[g].short.toLowerCase()}` : "/"} data-game={g} data-on={game === g ? "" : undefined} className="pill pill-game">
            {g ? GAMES[g].short : "Tout"}
          </Link>
        ))}
      </Pills>

      <Arrange blocks={blocks} initial={order} />
    </div>
  );
}
