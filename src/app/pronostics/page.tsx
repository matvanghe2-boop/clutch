import type { Metadata } from "next";
import Link from "next/link";
import { GAME_IDS, GAMES } from "@/config/follow";
import { ExactMoment } from "@/components/Moments";
import { type DeckCard, PickDeck } from "@/components/PickDeck";
import { PronoReveal } from "@/components/PronoReveal";
import { cn, Empty, GameTag, Num, SectionTitle } from "@/components/ui";
import { findMatch, matchHref, predictionResult, teamById } from "@/lib/derive";
import { isAdmin } from "@/lib/admin";
import { clock, dayLabel, shortDate } from "@/lib/format";
import { awaitingPick } from "@/lib/picks";
import { revealedIds } from "@/lib/reveal-store";
import { largeLogo, teamColors } from "@/lib/team-colors";
import { loadSnapshot } from "@/lib/load-snapshot";
import { matchMorph } from "@/lib/morph-attrs";
import { loadPredictions } from "@/lib/prediction-store";
import { judge, possibleScores, type Verdict } from "@/lib/predictions";

export const metadata: Metadata = { title: "Pronostics" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ANY_FORMAT: [number, number][] = [3, 5, 7]
  .flatMap((bo) => possibleScores(bo) ?? [])
  .filter(([a, b], i, all) => all.findIndex(([x, y]) => x === a && y === b) === i)
  // Rangés par format : 2–0 2–1, puis 3–0 3–1 3–2, puis 4–0 … 4–3.
  .sort((p, q) => Math.max(...p) - Math.max(...q) || Math.min(...p) - Math.min(...q));

/** Un verdict plus vieux que ça est déjà connu : on ne le cache plus derrière une carte à retourner. */
const REVEAL_WINDOW_S = 4 * 86400;

const percent = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "—");

export default async function PredictionsPage({ searchParams }: { searchParams: SearchParams }) {
  const [snap, predictions, admin, revealed] = await Promise.all([loadSnapshot(), loadPredictions(), isAdmin(), revealedIds()]);
  const lost = (await searchParams).prono === "introuvable";
  const now = Date.now() / 1000;

  const rows = Object.entries(predictions)
    .map(([id, p]) => {
      const found = findMatch(snap, id);
      // Un pronostic donné avant que Liquipedia publie l'heure n'en garde pas : on prend celle du match,
      // connue depuis, sinon le moment où il a été donné. Sans date, il restait en tête de l'historique.
      const when = p.timestamp ?? found?.o.match.timestamp ?? Date.parse(p.at) / 1000;
      const result = predictionResult(snap, id, { ...p, timestamp: p.timestamp ?? found?.o.match.timestamp });
      const verdict: Verdict | undefined = result ? judge(p, result) : undefined;
      const team = teamById(snap, p.teamId);
      return { id, p, when, found, result, verdict, team };
    })
    .sort((a, b) => b.when - a.when);

  const judged = rows.filter((r) => r.verdict);
  const points = judged.reduce((n, r) => n + r.verdict!.points, 0);
  const exact = judged.filter((r) => r.verdict!.exact).length;
  const winners = judged.filter((r) => r.verdict!.winner).length;
  const pending = rows.length - judged.length;

  // Le tas de la semaine : les matchs sans pronostic dont le format est connu (il dit les scores possibles).
  const deck: DeckCard[] = admin
    ? awaitingPick(snap, predictions, now, 7 * 86400, { undated: true }).flatMap(({ match: m, us, them }) => {
        // Format inconnu (Liquipedia ne l'a pas encore écrit) : les scores d'un Bo3, d'un Bo5 et d'un Bo7.
        const scores = possibleScores(m.bestOf) ?? ANY_FORMAT;
        if (!them) return [];
        const side = (ref: typeof us) => ({ name: ref.name, short: ref.short ?? ref.name, logo: largeLogo(ref), color: teamColors(ref)?.a });
        return [{ id: m.id, us: side(us), them: side(them), // Le jour sans l'heure, ou ni l'un ni l'autre : le match se pronostique quand même.
        when: m.timestamp === undefined ? "Date à venir" : `${dayLabel(m.timestamp, now)} · ${m.timeTbd ? "heure à venir" : clock(m.timestamp)}`, tournament: m.tournament?.name, scores, format: m.bestOf ? `Bo${m.bestOf}` : undefined }];
      })
    : [];

  const byGame = GAME_IDS.map((g) => {
    const of = judged.filter((r) => r.p.wiki === g);
    return { game: g, count: of.length, points: of.reduce((n, r) => n + r.verdict!.points, 0), winners: of.filter((r) => r.verdict!.winner).length };
  }).filter((g) => g.count);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="brand-text display text-5xl sm:text-7xl">Pronostics</h1>
        <p className="mt-1 text-sm text-dim">Score exact : 3 points. Bon vainqueur : 1 point. On pronostique ici, en glissant les cartes, ou depuis la page de chaque match, jusqu&apos;au coup d&apos;envoi.</p>
      </header>

      {lost && <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">Ce match n&apos;est plus connu du site.</div>}

      {deck.length > 0 && (
        <section>
          <SectionTitle aside={<span className="hidden text-xs text-faint sm:inline">← → au clavier · ↓ pour passer</span>}>À pronostiquer</SectionTitle>
          <PickDeck cards={deck} />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Points" value={<Num value={points} />} />
        <Stat label="Scores exacts" value={<Num value={exact} />} detail={judged.length ? `sur ${judged.length}` : undefined} />
        <Stat label="Bons vainqueurs" value={percent(winners, judged.length)} detail={judged.length ? `${winners} sur ${judged.length}` : undefined} />
        <Stat label="En attente" value={<Num value={pending} />} />
      </section>

      {byGame.length > 1 && (
        <section>
          <SectionTitle>Par jeu</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {byGame.map((g) => (
              <div key={g.game} data-game={g.game} className="panel lift flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <GameTag game={g.game} long />
                <span className="text-dim">
                  <b className="font-display text-lg text-ink">{g.points}</b> pts · {percent(g.winners, g.count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Historique</SectionTitle>
        {rows.length ? (
          <div className="divide-y divide-line overflow-hidden panel">
            {rows.map(({ id, p, when, found, result, verdict, team }) => {
              const label = `${team?.page ?? p.teamId} – ${p.opponent.name}`;
              return (
                <div key={id} data-game={p.wiki} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto] sm:px-4">
                  <span className="text-xs text-faint">{shortDate(when, now)}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" title={GAMES[p.wiki].label} />
                      {found ? (
                        <Link href={matchHref(found.o.match)} {...matchMorph(found.o.us, found.o.them)} className="truncate hover:text-white">
                          {label}
                        </Link>
                      ) : (
                        <span className="truncate">{label}</span>
                      )}
                    </span>
                    {p.tournament && <span className="block truncate text-xs text-faint">{p.tournament}</span>}
                  </span>
                  <span className="text-right font-display tabular-nums">
                    <span className="text-base font-semibold">
                      {p.us}–{p.them}
                    </span>
                    {result && (
                      <span className="block text-xs text-faint">
                        réel {result.us}–{result.them}
                      </span>
                    )}
                  </span>
                  <span className="col-span-3 justify-self-end sm:col-span-1">
                    {verdict ? (
                      <PronoReveal id={id} covered={Boolean(result && now - when < REVEAL_WINDOW_S && !revealed.has(id))} verdict={verdict}>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          verdict.points === 3 ? "bg-win/15 text-win" : verdict.points === 1 ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : "bg-loss/15 text-loss",
                        )}
                      >
                        {verdict.exact ? "Exact · +3" : verdict.winner ? "Vainqueur · +1" : "Raté · 0"}
                        {verdict.exact && <ExactMoment id={id} />}
                      </span>
                      </PronoReveal>
                    ) : (
                      <span className="text-xs text-faint">{when > now ? "à venir" : "en attente"}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>Aucun pronostic pour l&apos;instant. Ouvre un match à venir (« Détails du match ») pour donner ton score.</Empty>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="panel lift tile">
      <div className="text-xs text-faint">{label}</div>
      <div className="score mt-1.5 text-3xl">{value}</div>
      {detail && <div className="text-xs text-faint">{detail}</div>}
    </div>
  );
}
