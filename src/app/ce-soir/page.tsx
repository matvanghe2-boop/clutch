import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { MatchRow, NextMatch, ResultRow } from "@/components/matches";
import { StreamPlayer } from "@/components/StreamPlayer";
import { cn, Empty, LiveBadge, Logo, SectionTitle, StreamLinks } from "@/components/ui";
import { headToHead, matchHref, type Oriented, statusOf, upcomingFeed } from "@/lib/derive";
import { clock, dayLabel } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { matchMorph } from "@/lib/morph-attrs";
import { largeLogo, teamColors } from "@/lib/team-colors";
import { embeddable, matchStreams } from "@/lib/streams";
import { eveningOf, onAir } from "@/lib/tonight";
import { overlapsOf } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ce soir" };

const fullDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default async function TonightPage() {
  const snap = await loadSnapshot();
  const now = Date.now() / 1000;
  const host = (await headers()).get("host") ?? "localhost";
  const evening = eveningOf(snap, now);

  // Plusieurs lecteurs côte à côte : le son du premier seulement, pour ne pas les entendre tous à la fois.
  const air = evening.tonight ? onAir(evening.matches, now) : [];
  const players = air.map((o) => ({ o, streams: matchStreams(o.team, o.match.streams) })).filter((p) => embeddable(p.streams, host).length > 0);
  const shown = new Set(players.map((p) => p.o.match.id));
  const rest = evening.matches.filter((o) => !shown.has(o.match.id));
  const [hero, ...others] = players.length ? [undefined, ...rest] : rest;

  const first = evening.matches[0]?.match.timestamp;
  const title = evening.tonight ? "Ce soir" : first ? dayLabel(first - 6 * 3600, now) : "Ce soir";
  const live = evening.matches.filter((o) => statusOf(o.match, now) === "live").length;
  const next = evening.matches.find((o) => statusOf(o.match, now) === "upcoming" && !o.match.timeTbd)?.match.timestamp;
  const summary = [
    plural(evening.matches.length + evening.done.length, "match"),
    live ? plural(live, "en direct") : undefined,
    next && !live ? `prochain à ${clock(next)}` : undefined,
  ].filter(Boolean);
  const nothing = !evening.matches.length && !evening.done.length;
  // Tout est joué ce soir : la page annonce la suite au lieu de rester vide.
  const after = evening.tonight && !evening.matches.length ? upcomingFeed(snap).find((o) => statusOf(o.match, now) === "upcoming") : undefined;
  // Deux de mes équipes en même temps ce soir : la page le dit avant qu'on le découvre.
  const clashes = overlapsOf(evening.matches);
  const clashing = evening.matches.filter((o) => clashes.has(o.match.id));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="brand-text display text-6xl sm:text-8xl">{title}</h1>
        <p className="mt-2 text-sm text-dim">
          {evening.tonight ? fullDate.format(new Date(now * 1000)) : "Rien pour tes équipes ce soir : voici leur prochaine soirée."}
          {!nothing && <span className="text-faint"> · {summary.join(" · ")}</span>}
        </p>
      </header>

      {nothing && <Empty>Aucun match annoncé pour tes équipes pour le moment.</Empty>}

      {clashing.length > 1 && (
        <div className="clash-banner panel">
          <span className="clash-icons" aria-hidden>
            {clashing.slice(0, 3).map((o) => (
              <Logo key={o.match.id} team={o.us} size={26} />
            ))}
          </span>
          <p className="min-w-0 text-sm">
            <b className="text-ink">Matchs en même temps</b>
            <span className="text-dim">
              {" "}
              · {clashing.map((o) => `${o.us.short ?? o.us.name} à ${o.match.timestamp ? clock(o.match.timestamp) : "?"}`).join(", ")}.{" "}
              Les lecteurs s&apos;affichent côte à côte une heure avant le début.
            </span>
          </p>
        </div>
      )}

      {players.length > 0 && (
        <section>
          <SectionTitle aside={players.length > 1 ? <span className="text-xs text-faint">son coupé sur les lecteurs suivants</span> : undefined}>À regarder maintenant</SectionTitle>
          <div className={cn("grid gap-4", players.length > 1 && "lg:grid-cols-2")}>
            {players.map(({ o, streams }, i) => (
              <Screen key={o.match.id} o={o} now={now} host={host} streams={streams} muted={i > 0} />
            ))}
          </div>
        </section>
      )}

      {hero && <NextMatch o={hero} now={now} h2h={headToHead(snap, hero.team, hero.them)} />}

      {after && (
        <div className="space-y-4">
          <h2 className="display text-2xl text-dim sm:text-3xl">Prochain rendez-vous</h2>
          <NextMatch o={after} now={now} h2h={headToHead(snap, after.team, after.them)} />
        </div>
      )}

      {others.length > 0 && (
        <section>
          <SectionTitle>{players.length ? "Ensuite" : "Puis"}</SectionTitle>
          <div className="space-y-2">
            {others.map((o) => o && <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, o.team, o.them)} />)}
          </div>
        </section>
      )}

      {evening.done.length > 0 && (
        <section>
          <SectionTitle>Déjà joués ce soir</SectionTitle>
          <div className="divide-y divide-line overflow-hidden panel">
            {evening.done.map((r) => (
              <ResultRow key={`${r.team.id}-${r.timestamp}`} r={r} now={now} showGame />
            ))}
          </div>
        </section>
      )}

      {evening.undated.length > 0 && (
        <section>
          <SectionTitle aside={<span className="text-xs text-faint">relu toutes les 10 min</span>}>Horaire à venir</SectionTitle>
          <div className="space-y-2">
            {evening.undated.map((o) => (
              <MatchRow key={o.match.id} o={o} now={now} h2h={headToHead(snap, o.team, o.them)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Screen({ o, now, host, streams, muted }: { o: Oriented; now: number; host: string; streams: ReturnType<typeof matchStreams>; muted: boolean }) {
  const m = o.match;
  return (
    <div data-game={m.wiki} className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href={matchHref(m)} {...matchMorph(o.us, o.them)} className="flex min-w-0 items-center gap-2 font-medium hover:underline">
          <Logo team={o.us} size={20} />
          <span className="truncate">{o.us.short ?? o.us.name}</span>
          <span className="text-xs text-faint">vs</span>
          <Logo team={o.them} size={20} />
          <span className="truncate">{o.them?.short ?? o.them?.name ?? "À déterminer"}</span>
        </Link>
        {statusOf(m, now) === "live" ? <LiveBadge className="shrink-0" /> : <span className="shrink-0 font-display font-semibold">{m.timestamp ? clock(m.timestamp) : ""}</span>}
      </div>
      <StreamPlayer
        streams={embeddable(streams, host, { muted })}
        board={{
          id: m.id,
          us: { name: o.us.short ?? o.us.name, logo: largeLogo(o.us), color: teamColors(o.us)?.a },
          them: { name: o.them?.short ?? o.them?.name ?? "?", logo: o.them ? largeLogo(o.them) : undefined, color: o.them ? teamColors(o.them)?.a : undefined },
          score: statusOf(m, now) === "live" ? `${o.usScore ?? 0} – ${o.themScore ?? 0}` : m.timestamp ? clock(m.timestamp) : "VS",
          live: statusOf(m, now) === "live",
        }}
      />
      <StreamLinks streams={streams.filter((s) => s.platform === "youtube")} max={2} />
    </div>
  );
}
