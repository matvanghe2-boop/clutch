import Link from "next/link";
import { GAME_IDS, GAMES } from "@/config/follow";
import { MatchRow, NextMatch, ResultRow, TournamentCard } from "@/components/matches";
import { cn, Empty, SectionTitle } from "@/components/ui";
import { headToHead, recentFeed, statusOf, trackedTournaments, upcomingFeed } from "@/lib/derive";
import { dayKey, dayLabel } from "@/lib/format";
import { readHidden } from "@/lib/hidden";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { GameId } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseGame(v: string | string[] | undefined): GameId | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return GAME_IDS.find((g) => g === s || GAMES[g].short.toLowerCase() === s?.toLowerCase());
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

  const days = new Map<string, typeof rest>();
  for (const o of rest) {
    const key = o.match.timestamp ? dayKey(o.match.timestamp) : "zz";
    days.set(key, [...(days.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-10">
      <nav className="flex gap-1.5" aria-label="Filtrer par jeu">
        {[undefined, ...GAME_IDS].map((g) => (
          <Link
            key={g ?? "all"}
            href={g ? `/?jeu=${GAMES[g].short.toLowerCase()}` : "/"}
            data-game={g}
            className={cn(
              "rounded-full border px-3 py-1 font-display text-sm font-semibold tracking-wide transition-colors",
              game === g
                ? g
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                  : "border-ink bg-ink text-bg"
                : "border-line text-dim hover:border-faint hover:text-ink",
            )}
          >
            {g ? GAMES[g].short : "Tout"}
          </Link>
        ))}
      </nav>

      {hero ? (
        <NextMatch o={hero} now={now} h2h={headToHead(snap, hero.team, hero.them)} />
      ) : (
        <Empty>Aucun match annoncé pour {game ? GAMES[game].label : "tes équipes"} pour le moment.</Empty>
      )}

      {rest.length > 0 && (
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
                <h3 className="mb-2 text-sm font-medium text-dim">
                  {list[0].match.timestamp ? dayLabel(list[0].match.timestamp, now) : "Date à confirmer"}
                </h3>
                <div className="space-y-2">
                  {list.map((o) => (
                    <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, o.team, o.them)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <SectionTitle>Derniers résultats</SectionTitle>
          {results.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
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
    </div>
  );
}
