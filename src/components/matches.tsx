import Link from "next/link";
import { GAMES } from "@/config/follow";
import { competitionHref, type HeadToHead, type Oriented, type PastMatch, statusOf, type Tracked } from "@/lib/derive";
import { clock, dayLabel, infoDate, relative, shortDate, shortDay } from "@/lib/format";
import type { TeamRef } from "@/lib/types";
import { Countdown } from "./Countdown";
import { cn, GameTag, LiveBadge, Logo, ResultBadge, StreamLinks } from "./ui";

function TournamentLine({ o }: { o: Oriented }) {
  const t = o.match.tournament;
  if (!t) return null;
  const label = [t.name, t.stage && t.stage !== t.name ? t.stage : null].filter(Boolean).join(" · ");
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

function TeamColumn({ team, align }: { team: TeamRef | null; align: "start" | "end" }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:gap-4", align === "end" && "sm:flex-row-reverse")}>
      <Logo team={team} size={64} className="drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)]" />
      <div className={cn("min-w-0 text-center", align === "end" ? "sm:text-right" : "sm:text-left")}>
        <div className="line-clamp-2 break-words font-display text-lg font-semibold leading-tight sm:text-2xl">{team?.name ?? "À déterminer"}</div>
        {team?.short && <div className="text-xs tracking-wider text-faint">{team.short}</div>}
      </div>
    </div>
  );
}

/** Le grand bandeau du prochain match (ou du match en cours). */
export function NextMatch({ o, now, h2h }: { o: Oriented; now: number; h2h: HeadToHead }) {
  const m = o.match;
  const st = statusOf(m, now);
  const live = st === "live";
  return (
    <section data-game={m.wiki} className="relative overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_220px_at_50%_-20%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
      <div className="relative p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-dim">
            <GameTag game={m.wiki} />
            <TournamentLine o={o} />
          </div>
          {live ? (
            <LiveBadge />
          ) : (
            <span className="shrink-0 font-display font-semibold uppercase tracking-[0.2em] text-faint">Prochain match</span>
          )}
        </div>

        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:items-center sm:gap-6">
          <TeamColumn team={o.us} align="end" />
          <div className="text-center">
            {live ? (
              <div className="font-display text-5xl font-bold tabular-nums sm:text-6xl">
                {o.usScore ?? 0}
                <span className="px-2 text-faint">–</span>
                {o.themScore ?? 0}
              </div>
            ) : m.timestamp ? (
              <>
                <div className="font-display text-5xl font-bold leading-none tabular-nums sm:text-6xl">{clock(m.timestamp)}</div>
                <div className="mt-1.5 text-sm text-dim">{dayLabel(m.timestamp, now)}</div>
              </>
            ) : (
              <div className="font-display text-3xl text-dim">Horaire à venir</div>
            )}
            {!live && m.timestamp && (
              <div className="mt-2 font-display text-lg font-semibold text-[var(--accent)]">
                <Countdown ts={m.timestamp} initialNow={now} />
              </div>
            )}
          </div>
          <TeamColumn team={o.them} align="start" />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-dim">
            {m.bestOf && <span className="font-display font-semibold text-ink">Bo{m.bestOf}</span>}
            {m.round && <span>{m.round}</span>}
            <H2HLine h2h={h2h} />
          </div>
          <StreamLinks streams={m.streams} />
        </div>
      </div>
    </section>
  );
}

export function MatchRow({ o, now, h2h }: { o: Oriented; now: number; h2h?: HeadToHead }) {
  const m = o.match;
  const st = statusOf(m, now);
  return (
    <div
      data-game={m.wiki}
      className="relative grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-line bg-panel py-2.5 pl-4 pr-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:pr-4"
    >
      <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-[var(--accent)]" />
      <div className="text-center">
        {st === "live" ? (
          <LiveBadge />
        ) : (
          <div className="font-display text-2xl font-semibold leading-none tabular-nums">{m.timestamp ? clock(m.timestamp) : "—"}</div>
        )}
        <div className="mt-1 truncate text-[11px] text-faint">
          {st === "live" ? `${o.usScore ?? 0} – ${o.themScore ?? 0}` : m.timestamp ? relative(m.timestamp, now) : "à confirmer"}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Logo team={o.us} size={22} />
          <span className="shrink-0 font-medium">{o.us.short ?? o.us.name}</span>
          <span className="shrink-0 font-display text-xs text-faint">VS</span>
          <Logo team={o.them} size={22} />
          <span className="truncate font-medium">{o.them?.name ?? "À déterminer"}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-dim">
          <GameTag game={m.wiki} />
          <TournamentLine o={o} />
          {m.bestOf && <span className="shrink-0 text-faint">Bo{m.bestOf}</span>}
        </div>
        {h2h && h2h.meetings.length > 0 && (
          <div className="mt-1 text-[11px] sm:hidden">
            <H2HLine h2h={h2h} compact />
          </div>
        )}
      </div>
      <div className="hidden flex-col items-end gap-1.5 text-[11px] sm:flex">
        <StreamLinks streams={m.streams} compact max={2} />
        {h2h && <H2HLine h2h={h2h} compact />}
      </div>
    </div>
  );
}

export function ResultRow({ r, now, showGame }: { r: PastMatch; now: number; showGame?: boolean }) {
  return (
    <div
      data-game={r.team.game}
      className="grid grid-cols-[3.25rem_1.5rem_1fr_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[4rem_1.5rem_1fr_auto] sm:px-4"
    >
      <span className="text-xs text-faint">{shortDate(r.timestamp, now)}</span>
      <ResultBadge result={r.result} />
      <div className="flex min-w-0 items-center gap-2">
        {showGame && <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" title={GAMES[r.team.game].label} />}
        <span className="shrink-0 text-xs text-faint">vs</span>
        <Logo team={r.opponent} size={20} />
        <span className="min-w-0 shrink-0 basis-auto truncate" style={{ maxWidth: "65%" }}>
          {r.opponent?.name ?? "?"}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-faint sm:inline">· {r.tournament.name}</span>
      </div>
      <span className="font-display text-xl font-semibold tabular-nums">
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
      className="group flex flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--color-line))]"
    >
      <div className="flex items-center justify-between gap-2">
        <GameTag game={t.wiki} />
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
      </div>
      <div className="mt-2.5 font-display text-xl font-semibold leading-tight group-hover:text-white">{t.name}</div>
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
                {shortDay(tr.next.match.timestamp, now)} {clock(tr.next.match.timestamp)}
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
