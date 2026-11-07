import type { Metadata } from "next";
import Link from "next/link";
import { GAME_IDS, GAMES } from "@/config/follow";
import { cn, Empty, GameTag, SectionTitle } from "@/components/ui";
import { findMatch, matchHref, predictionResult, teamById } from "@/lib/derive";
import { shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { loadPredictions } from "@/lib/prediction-store";
import { judge, type Verdict } from "@/lib/predictions";

export const metadata: Metadata = { title: "Pronostics" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const percent = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "—");

export default async function PredictionsPage({ searchParams }: { searchParams: SearchParams }) {
  const [snap, predictions] = await Promise.all([loadSnapshot(), loadPredictions()]);
  const lost = (await searchParams).prono === "introuvable";
  const now = Date.now() / 1000;

  const rows = Object.entries(predictions)
    .map(([id, p]) => {
      const found = findMatch(snap, id);
      const result = predictionResult(snap, id, p);
      const verdict: Verdict | undefined = result ? judge(p, result) : undefined;
      const team = teamById(snap, p.teamId);
      return { id, p, found, result, verdict, team };
    })
    .sort((a, b) => (b.p.timestamp ?? Infinity) - (a.p.timestamp ?? Infinity));

  const judged = rows.filter((r) => r.verdict);
  const points = judged.reduce((n, r) => n + r.verdict!.points, 0);
  const exact = judged.filter((r) => r.verdict!.exact).length;
  const winners = judged.filter((r) => r.verdict!.winner).length;
  const pending = rows.length - judged.length;

  const byGame = GAME_IDS.map((g) => {
    const of = judged.filter((r) => r.p.wiki === g);
    return { game: g, count: of.length, points: of.reduce((n, r) => n + r.verdict!.points, 0), winners: of.filter((r) => r.verdict!.winner).length };
  }).filter((g) => g.count);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Pronostics</h1>
        <p className="mt-1 text-sm text-dim">Score exact : 3 points. Bon vainqueur : 1 point. On pronostique depuis la page de chaque match, jusqu&apos;au coup d&apos;envoi.</p>
      </header>

      {lost && <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">Ce match n&apos;est plus connu du site.</div>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Points" value={String(points)} />
        <Stat label="Scores exacts" value={`${exact}`} detail={judged.length ? `sur ${judged.length}` : undefined} />
        <Stat label="Bons vainqueurs" value={percent(winners, judged.length)} detail={judged.length ? `${winners} sur ${judged.length}` : undefined} />
        <Stat label="En attente" value={String(pending)} />
      </section>

      {byGame.length > 1 && (
        <section>
          <SectionTitle>Par jeu</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {byGame.map((g) => (
              <div key={g.game} data-game={g.game} className="flex items-center justify-between gap-3 panel px-4 py-3 text-sm">
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
            {rows.map(({ id, p, found, result, verdict, team }) => {
              const label = `${team?.page ?? p.teamId} – ${p.opponent.name}`;
              return (
                <div key={id} data-game={p.wiki} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto] sm:px-4">
                  <span className="text-xs text-faint">{p.timestamp ? shortDate(p.timestamp, now) : "—"}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" title={GAMES[p.wiki].label} />
                      {found ? (
                        <Link href={matchHref(found.o.match)} className="truncate hover:text-white">
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
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          verdict.points === 3 ? "bg-win/15 text-win" : verdict.points === 1 ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : "bg-loss/15 text-loss",
                        )}
                      >
                        {verdict.exact ? "Exact · +3" : verdict.winner ? "Vainqueur · +1" : "Raté · 0"}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">{p.timestamp && p.timestamp > now ? "à venir" : "en attente"}</span>
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

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</div>
      {detail && <div className="text-xs text-faint">{detail}</div>}
    </div>
  );
}
