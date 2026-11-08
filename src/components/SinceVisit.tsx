import Link from "next/link";
import { cookies } from "next/headers";
import { matchHref, type PastMatch, recentFeed, upcomingFeed } from "@/lib/derive";
import { clock, dayLabel, shortDay } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { expectedLength, moveOf, pairKey } from "@/lib/schedule";
import { accentOf } from "@/lib/team-colors";
import { VISIT_COOKIE } from "@/lib/visit";
import { VisitClose } from "./VisitClock";
import { Logo } from "./ui";

/** En dessous, ce n'est pas une absence : on vient de quitter l'appli un instant. */
const AWAY_MIN_S = 20 * 60;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/**
 * « Depuis ta dernière visite » : en rouvrant le site, ce qui s'est passé pendant l'absence.
 * Les résultats des matchs qui ont fini depuis, et les horaires que Liquipedia a déplacés.
 * La date de la dernière visite est un cookie posé quand on quitte le site (VisitClock) :
 * le serveur compose la carte avec la page, rien ne saute à l'écran.
 */
export async function SinceVisit({ now }: { now: number }) {
  const since = Number((await cookies()).get(VISIT_COOKIE)?.value);
  if (!Number.isFinite(since) || since <= 0 || now - since < AWAY_MIN_S) return null;
  const snap = await loadSnapshot();

  // Un match fini depuis : commencé assez tard pour qu'on n'ait pas pu voir son résultat.
  const missed = recentFeed(snap)
    .filter((r) => r.timestamp + expectedLength() > since && r.timestamp < now)
    .slice(0, 8);
  const moved = upcomingFeed(snap)
    .map((o) => ({ o, move: moveOf(snap, o) }))
    .filter((x): x is { o: typeof x.o; move: NonNullable<typeof x.move> } => Boolean(x.move && Date.parse(x.move.at) / 1000 > since))
    .slice(0, 4);
  if (!missed.length && !moved.length) return null;

  const wins = missed.filter((r) => r.result === "win").length;
  const losses = missed.filter((r) => r.result === "loss").length;
  const summary = [plural(missed.length, "match"), wins ? plural(wins, "victoire") : null, losses ? plural(losses, "défaite") : null, moved.length ? plural(moved.length, "horaire changé") : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="since panel" aria-label="Depuis ta dernière visite">
      <div className="since-head">
        <div className="min-w-0">
          <h2 className="display text-xl sm:text-2xl">Depuis ta dernière visite</h2>
          <p className="text-xs text-faint">
            {dayLabel(since, now)} à {clock(since)} · {summary}
          </p>
        </div>
        <VisitClose />
      </div>
      {missed.length > 0 && (
        <ul className="since-results">
          {missed.map((r, i) => (
            <li key={`${r.team.id}-${r.timestamp}`} style={{ ...accentOf({ name: r.team.page, page: r.team.page, logo: snap.teams[r.team.id]?.logo }), "--i": i } as React.CSSProperties}>
              <Result r={r} logo={snap.teams[r.team.id]?.logo} />
            </li>
          ))}
        </ul>
      )}
      {moved.length > 0 && (
        <ul className="since-moves">
          {moved.map(({ o, move }) => (
            <li key={pairKey(o) ?? o.match.id}>
              <Link href={matchHref(o.match)} className="hover:text-ink">
                <span className="note-tag note-moved">Heure changée</span> {o.us.short ?? o.us.name} – {o.them?.short ?? o.them?.name} :{" "}
                <s className="text-faint">{clock(move.from)}</s> → <b className="text-ink">{shortDay(move.to, now)} {clock(move.to)}</b>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Result({ r, logo }: { r: PastMatch; logo?: string }) {
  const body = (
    <>
      <Logo team={{ name: r.team.page, logo }} size={20} />
      <b className={r.result === "win" ? "text-win" : r.result === "loss" ? "text-loss" : "text-dim"}>{r.result === "win" ? "V" : r.result === "loss" ? "D" : "N"}</b>
      <span className="score text-lg tabular-nums">
        {r.usScore}–{r.themScore}
      </span>
      <Logo team={r.opponent} size={20} />
      <span className="truncate text-xs text-dim">{r.opponent?.short ?? r.opponent?.name ?? "?"}</span>
    </>
  );
  return r.matchId ? (
    <Link href={`/match/${encodeURIComponent(r.matchId)}`} className="since-chip" data-result={r.result}>
      {body}
    </Link>
  ) : (
    <span className="since-chip" data-result={r.result}>
      {body}
    </span>
  );
}
