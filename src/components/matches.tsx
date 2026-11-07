import Link from "next/link";
import { GAMES } from "@/config/follow";
import { competitionHref, type HeadToHead, matchHref, type Oriented, type PastMatch, statusOf, type Tracked } from "@/lib/derive";
import { clock, dayLabel, infoDate, relative, shortDate, shortDay } from "@/lib/format";
import { competitionMorph, matchMorph } from "@/lib/morph-attrs";
import { matchStreams } from "@/lib/streams";
import { accentOf, teamColors } from "@/lib/team-colors";
import { CountdownCells } from "./Countdown";
import { LiveScore } from "./Moments";
import { cn, GameTag, LiveBadge, Logo, ResultBadge, StreamLinks } from "./ui";
import { Versus } from "./versus";

function TournamentLine({ o }: { o: Oriented }) {
  const t = o.match.tournament;
  if (!t) return null;
  // Le tour (« Day 6 », « Semifinals ») situe mieux le match que la phase (« League Play », « Playoffs »).
  const detail = o.match.round ?? t.stage;
  const label = [t.name, detail && detail !== t.name ? detail : null].filter(Boolean).join(" · ");
  return t.page ? (
    <Link href={competitionHref(o.match.wiki, t.page, t.anchor)} className="truncate hover:text-ink">
      {label}
    </Link>
  ) : (
    <span className="truncate">{label}</span>
  );
}

export function H2HLine({ h2h, compact }: { h2h: HeadToHead; compact?: boolean }) {
  if (!h2h.meetings.length) return compact ? null : <span className="text-faint">Première rencontre connue</span>;
  const last = h2h.meetings[0];
  return (
    <span className="text-faint">
      Face-à-face <b className="font-semibold text-win">{h2h.wins}</b>
      <span className="px-0.5">–</span>
      <b className="font-semibold text-loss">{h2h.losses}</b>
      {!compact && (
        <>
          {" · dernier "}
          <span className={last.result === "win" ? "text-win" : last.result === "loss" ? "text-loss" : "text-dim"}>
            {last.usScore}-{last.themScore}
          </span>
        </>
      )}
    </span>
  );
}

/** Le grand bandeau du prochain match (ou du match en cours). */
export function NextMatch({ o, now, h2h }: { o: Oriented; now: number; h2h: HeadToHead }) {
  const m = o.match;
  const streams = matchStreams(o.team, m.streams);
  const st = statusOf(m, now);
  const live = st === "live";
  return (
    <Versus
      game={m.wiki}
      live={live}
      us={o.us}
      them={o.them}
      morph={matchMorph(o.us, o.them)}
      top={
        <>
          <div className="flex min-w-0 items-center gap-2 text-dim">
            <GameTag game={m.wiki} />
            <TournamentLine o={o} />
          </div>
          {live ? <LiveBadge /> : <span className="display shrink-0 text-sm tracking-[0.14em] text-faint">Prochain match</span>}
        </>
      }
      center={
        live ? (
          <LiveScore us={o.usScore ?? 0} them={o.themScore ?? 0} bestOf={m.bestOf} />
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
            <H2HLine h2h={h2h} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StreamLinks streams={streams} max={4} />
            {live && streams.length > 0 && (
              <Link href={`${matchHref(m)}#regarder`} className="rounded-md bg-live px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90">
                ▶ Regarder
              </Link>
            )}
            <Link href={matchHref(m)} className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition-transform hover:scale-105">
              Feuille de match →
            </Link>
          </div>
        </>
      }
    />
  );
}

export function MatchRow({ o, now, h2h }: { o: Oriented; now: number; h2h?: HeadToHead }) {
  const m = o.match;
  const streams = matchStreams(o.team, m.streams);
  const st = statusOf(m, now);
  return (
    <div
      data-game={m.wiki}
      style={accentOf(o.us)}
      {...matchMorph(o.us, o.them)}
      data-flip={m.id}
      className={cn("panel lift sheen relative grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 py-2.5 pl-4 pr-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:pr-4", st === "live" && "live-ring")}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)] shadow-[0_0_14px_var(--accent)]" />
      <div className="text-center">
        {st === "live" ? (
          <LiveBadge />
        ) : (
          <div className="score text-3xl">
            {m.timestamp && !m.timeTbd ? clock(m.timestamp) : "—"}
          </div>
        )}
        <div className="mt-1 truncate text-[11px] text-faint">
          {st === "live"
            ? `${o.usScore ?? 0} – ${o.themScore ?? 0}`
            : m.timeTbd
              ? "heure à conf."
              : m.timestamp
                ? relative(m.timestamp, now)
                : "à confirmer"}
        </div>
      </div>
      <div className="min-w-0">
        <Link href={matchHref(m)} className="flex min-w-0 items-center gap-2 hover:text-white">
          <Logo team={o.us} size={22} />
          <span className="display shrink-0 text-lg">{o.us.short ?? o.us.name}</span>
          <span className="shrink-0 font-display text-xs italic text-faint">VS</span>
          <Logo team={o.them} size={22} />
          <span className="display truncate text-lg">{o.them?.name ?? "À déterminer"}</span>
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-dim">
          <GameTag game={m.wiki} />
          <TournamentLine o={o} />
          {m.bestOf && <span className="shrink-0 text-faint">Bo{m.bestOf}</span>}
          {/* Sur mobile, la colonne des streams disparaît : le stream principal passe ici. */}
          <span className="ml-auto shrink-0 sm:hidden">
            <StreamLinks streams={streams} compact max={1} />
          </span>
        </div>
        {h2h && h2h.meetings.length > 0 && (
          <div className="mt-1 text-[11px] sm:hidden">
            <H2HLine h2h={h2h} compact />
          </div>
        )}
      </div>
      <div className="hidden flex-col items-end gap-1.5 text-[11px] sm:flex">
        <StreamLinks streams={streams} compact max={3} />
        {h2h && <H2HLine h2h={h2h} compact />}
      </div>
    </div>
  );
}

export function ResultRow({ r, now, showGame }: { r: PastMatch; now: number; showGame?: boolean }) {
  return (
    <div
      data-game={r.team.game}
      style={accentOf({ name: r.team.page, page: r.team.page })}
      {...(r.matchId ? matchMorph({ name: r.team.page, page: r.team.page }, r.opponent) : {})}
      data-flip={`${r.team.id}-${r.timestamp}`}
      className={cn(
        "row-hover grid grid-cols-[3.25rem_1.5rem_1fr_auto] items-center gap-3 border-l-2 px-3 py-2.5 sm:grid-cols-[4rem_1.5rem_1fr_auto] sm:px-4",
        r.result === "win" ? "border-l-win/70" : r.result === "loss" ? "border-l-loss/70" : "border-l-faint/40",
      )}
    >
      <span className="text-xs text-faint">{shortDate(r.timestamp, now)}</span>
      <ResultBadge result={r.result} />
      <div className="flex min-w-0 items-center gap-2">
        {showGame && <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" title={GAMES[r.team.game].label} />}
        <span className="shrink-0 text-xs text-faint">vs</span>
        <Logo team={r.opponent} size={20} />
        {r.matchId ? (
          <Link href={`/match/${encodeURIComponent(r.matchId)}`} className="min-w-0 shrink-0 basis-auto truncate hover:text-white" style={{ maxWidth: "65%" }}>
            {r.opponent?.name ?? "?"}
          </Link>
        ) : (
          <span className="min-w-0 shrink-0 basis-auto truncate" style={{ maxWidth: "65%" }}>
            {r.opponent?.name ?? "?"}
          </span>
        )}
        <span className="hidden min-w-0 flex-1 truncate text-xs text-faint sm:inline">· {r.tournament.name}</span>
      </div>
      <span className="score text-2xl">
        <span className={r.result === "win" ? "text-ink" : "text-dim"}>{r.usScore}</span>
        <span className="px-1 text-faint">–</span>
        <span className={r.result === "loss" ? "text-ink" : "text-dim"}>{r.themScore}</span>
      </span>
    </div>
  );
}

const STATE = {
  live: { label: "En direct", cls: "text-live bg-live/10" },
  running: { label: "En cours", cls: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" },
  upcoming: { label: "À venir", cls: "text-dim bg-panel-2" },
  finished: { label: "Terminée", cls: "text-faint bg-panel-2" },
} as const;

export function TournamentCard({ tr, now }: { tr: Tracked; now: number }) {
  const t = tr.tournament;
  const start = infoDate(t.info["Start Date"], now);
  const end = infoDate(t.info["End Date"], now);
  const dates = start && end && start !== end ? `${start} → ${end}` : (start ?? end);
  const meta = [dates, t.info["Location"], t.info["Prize Pool"]].filter(Boolean).join(" · ");
  const st = STATE[tr.state];
  const rank = tr.standing ? Number(tr.standing.row.rank) : NaN;
  return (
    <Link
      href={competitionHref(t.wiki, t.page)}
      data-game={t.wiki}
      style={accentOf({ name: tr.team.page, page: tr.team.page })}
      {...competitionMorph(teamColors({ name: tr.team.page, page: tr.team.page })?.a)}
      data-flip={t.key}
      className="panel lift sheen group flex flex-col p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <GameTag game={t.wiki} />
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
      </div>
      <div className="display mt-2.5 text-2xl group-hover:text-white">{t.name}</div>
      {meta && <div className="mt-1 text-xs text-faint">{meta}</div>}
      <div className="mt-auto space-y-1.5 pt-4 text-sm">
        {tr.standing && (
          <div className="flex items-center justify-between gap-2 text-dim">
            <span className="truncate">{tr.standing.table}</span>
            <span className="shrink-0">
              <b className="font-display text-base text-ink">{Number.isNaN(rank) ? tr.standing.row.rank : `${rank}${rank === 1 ? "er" : "e"}`}</b>
              <span className="text-faint">/{tr.standing.size}</span>
              {tr.standing.row.cells[0] && <span className="ml-2 text-faint">{tr.standing.row.cells[0]}</span>}
            </span>
          </div>
        )}
        {tr.next ? (
          <div className="flex items-center gap-2 text-dim">
            <span className="text-faint">Prochain</span>
            <Logo team={tr.next.them} size={16} />
            <span className="truncate">{tr.next.them?.name ?? "À déterminer"}</span>
            {tr.next.match.timestamp && (
              <span className="ml-auto shrink-0 text-faint">
                {shortDay(tr.next.match.timestamp, now)} {tr.next.match.timeTbd ? "" : clock(tr.next.match.timestamp)}
              </span>
            )}
          </div>
        ) : tr.last ? (
          <div className="flex items-center gap-2 text-dim">
            <span className="text-faint">Dernier</span>
            <ResultBadge result={tr.last.result ?? "draw"} />
            <span className="truncate">{tr.last.them?.name}</span>
            <span className="ml-auto shrink-0 font-display font-semibold text-ink">
              {tr.last.usScore}–{tr.last.themScore}
            </span>
          </div>
        ) : tr.state === "upcoming" && start ? (
          <div className="text-dim">
            <span className="text-faint">Début</span> {start} · équipe inscrite, matchs à programmer
          </div>
        ) : null}
      </div>
    </Link>
  );
}
