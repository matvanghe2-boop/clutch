import Link from "next/link";
import { GAMES } from "@/config/follow";
import type { CalCompetition, CalMatch } from "@/lib/calendar";
import { competitionHref } from "@/lib/derive";
import { clock, shortDate } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { cn, GameTag, LiveBadge, Logo, ResultBadge, StreamLinks } from "./ui";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_LANES = 3;

/**
 * Une ligne par compétition, gardée d'un jour à l'autre : la plus ancienne
 * prend la première ligne libre. Sans ça, les bandes changeraient de hauteur
 * à chaque nouvelle compétition et on ne pourrait plus suivre leur durée.
 * Mes compétitions passent en premier : seules trois lignes s'affichent.
 */
export function assignLanes(competitions: CalCompetition[]): Map<string, number> {
  const lanes = new Map<string, number>();
  const ends: string[] = [];
  const rank = { confirmed: 0, watched: 1, other: 2 };
  const order = [...competitions].sort(
    (a, b) => rank[a.relevance] - rank[b.relevance] || a.start.localeCompare(b.start) || b.end.localeCompare(a.end),
  );
  for (const c of order) {
    let lane = ends.findIndex((end) => end < c.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = c.end;
    lanes.set(c.key, lane);
  }
  return lanes;
}

export function competitionLink(c: Pick<CalCompetition, "game" | "page" | "relevance">): { href: string; external: boolean } {
  return c.relevance === "confirmed"
    ? { href: competitionHref(c.game, c.page), external: false }
    : { href: `https://liquipedia.net/${c.game}/${pageToPath(c.page)}`, external: true };
}

/** Style d'une compétition selon qu'on y joue, qu'on la surveille ou qu'elle est ailleurs dans le circuit. */
export const RELEVANCE_STYLE = {
  confirmed: "bg-[color-mix(in_srgb,var(--accent)_24%,transparent)] text-[var(--accent)]",
  watched:
    "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_16%,transparent)_0_5px,transparent_5px_9px)] text-[color-mix(in_srgb,var(--accent)_80%,var(--color-dim))]",
  other: "bg-panel-2 text-faint",
} as const;

export const RELEVANCE_LABEL = {
  confirmed: "Mon équipe y joue",
  watched: "À surveiller · inscription à confirmer",
  other: "",
} as const;

function Band({ c, day, weekStart }: { c: CalCompetition; day: string; weekStart: boolean }) {
  const first = day === c.start || weekStart;
  return (
    <div
      data-game={c.game}
      title={`${c.name} · ${GAMES[c.game].short}${c.relevance === "watched" ? " · inscription à confirmer" : ""}`}
      className={cn(
        "-mx-1.5 h-1.5 truncate px-1.5 text-[10px] font-medium leading-4 sm:h-4",
        RELEVANCE_STYLE[c.relevance],
        day === c.start && "ml-0 rounded-l",
        day === c.end && "mr-0 rounded-r",
      )}
    >
      <span className="hidden sm:inline">{first ? c.name : " "}</span>
    </div>
  );
}

function Chip({ m }: { m: CalMatch }) {
  const them = m.teams[1];
  return (
    <li data-game={m.game} className="flex min-w-0 items-center gap-1 text-[11px] leading-4">
      {m.status === "done" && m.result ? (
        <span className={cn("shrink-0 font-display font-bold", m.result === "win" ? "text-win" : m.result === "loss" ? "text-loss" : "text-dim")}>
          {m.result === "win" ? "V" : m.result === "loss" ? "D" : "N"} {m.scores[0]}-{m.scores[1]}
        </span>
      ) : m.status === "live" ? (
        <span className="live-dot size-1.5 shrink-0 rounded-full bg-live" />
      ) : m.timeTbd ? (
        <span className="shrink-0 text-faint" title="Heure à confirmer">
          ?h
        </span>
      ) : (
        <span className="shrink-0 font-display tabular-nums text-dim">{clock(m.timestamp)}</span>
      )}
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      <span className="truncate">{them?.short ?? them?.name ?? "?"}</span>
    </li>
  );
}

export function MonthGrid({
  month,
  days,
  today,
  matchesByDay,
  competitions,
}: {
  month: string;
  days: string[];
  today: string;
  matchesByDay: Map<string, CalMatch[]>;
  competitions: CalCompetition[];
}) {
  const lanes = assignLanes(competitions);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="grid grid-cols-7 border-b border-line text-[11px] font-medium uppercase tracking-wider text-faint">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.startsWith(month);
          const all = matchesByDay.get(day) ?? [];
          const ours = all.filter((m) => m.ours);
          const others = all.length - ours.length;
          const covering = competitions.filter((c) => c.start <= day && day <= c.end);
          const laneCount = Math.min(MAX_LANES, Math.max(0, ...covering.map((c) => (lanes.get(c.key) ?? 0) + 1)));
          const hidden = covering.filter((c) => (lanes.get(c.key) ?? 0) >= MAX_LANES).length;
          return (
            <a
              key={day}
              href={`#j-${day}`}
              className={cn(
                "group block min-h-16 border-b border-r border-line/60 p-1.5 transition-colors hover:bg-panel-2 sm:min-h-28",
                i % 7 === 6 && "border-r-0",
                !inMonth && "bg-bg/50",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                  day === today ? "bg-ink font-bold text-bg" : inMonth ? "text-dim" : "text-faint/60",
                )}
              >
                {Number(day.slice(8))}
              </span>
              {laneCount > 0 && (
                <div className="mt-1 space-y-0.5">
                  {Array.from({ length: laneCount }, (_, lane) => {
                    const c = covering.find((x) => lanes.get(x.key) === lane);
                    return c ? <Band key={c.key} c={c} day={day} weekStart={i % 7 === 0} /> : <div key={lane} className="h-1.5 sm:h-4" />;
                  })}
                </div>
              )}
              {hidden > 0 && <div className="mt-0.5 hidden text-[10px] text-faint sm:block">+{hidden} compét.</div>}
              {ours.length > 0 && (
                <>
                  <ul className="mt-1 hidden space-y-0.5 sm:block">
                    {ours.slice(0, 3).map((m) => (
                      <Chip key={m.id} m={m} />
                    ))}
                    {ours.length > 3 && <li className="text-[10px] text-faint">+{ours.length - 3}</li>}
                  </ul>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {ours.slice(0, 4).map((m) => (
                      <span key={m.id} data-game={m.game} className="size-1.5 rounded-full bg-[var(--accent)]" />
                    ))}
                  </div>
                </>
              )}
              {others > 0 && <div className="mt-0.5 hidden text-[10px] text-faint sm:block">{others} autre{others > 1 ? "s" : ""}</div>}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Un match dans l'agenda : mon équipe à gauche quand elle joue. */
export function AgendaMatch({ m, now }: { m: CalMatch; now: number }) {
  const [a, b] = m.teams;
  const score = m.scores[0] !== null || m.scores[1] !== null;
  const t = m.tournament;
  return (
    <div
      data-game={m.game}
      className={cn(
        "relative grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5 pl-4 pr-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto]",
        !m.ours && "opacity-80",
      )}
    >
      <span className={cn("absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r", m.ours ? "bg-[var(--accent)]" : "bg-line")} />
      <div className="text-center">
        {m.status === "live" ? (
          <LiveBadge />
        ) : m.status === "done" && m.result ? (
          <ResultBadge result={m.result} />
        ) : m.timeTbd ? (
          <span className="text-[11px] leading-tight text-faint">heure à confirmer</span>
        ) : (
          <span className="font-display text-xl font-semibold tabular-nums">{clock(m.timestamp)}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Logo team={a} size={20} />
          <span className={cn("truncate", m.ours && "font-medium")}>{m.ours ? (a?.short ?? a?.name) : (a?.name ?? "À déterminer")}</span>
          <span className="shrink-0 font-display text-xs text-faint">{score ? `${m.scores[0] ?? 0} – ${m.scores[1] ?? 0}` : "VS"}</span>
          <Logo team={b} size={20} />
          <span className="truncate">{b?.name ?? "À déterminer"}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-dim">
          <GameTag game={m.game} />
          {t?.page ? (
            <Link href={competitionHref(m.game, t.page, t.anchor)} className="truncate hover:text-ink">
              {[t.name, m.round ?? t.stage].filter(Boolean).join(" · ")}
            </Link>
          ) : (
            <span className="truncate">{t?.name}</span>
          )}
          {m.bestOf && <span className="shrink-0 text-faint">Bo{m.bestOf}</span>}
        </div>
      </div>
      <div className="hidden sm:block">
        {m.status !== "done" ? <StreamLinks streams={m.streams} compact max={2} /> : <span className="text-xs text-faint">{shortDate(m.timestamp, now)}</span>}
      </div>
    </div>
  );
}
