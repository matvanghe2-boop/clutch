import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { GAME_IDS, GAMES } from "@/config/follow";
import { AgendaMatch, competitionLink, MonthGrid, RELEVANCE_LABEL, WeekView } from "@/components/calendar";
import { cn, Empty, GameTag, Logo, SectionTitle } from "@/components/ui";
import { addDays, calendarData, type CalCompetition, type CalMatch, monthGrid, type Scope, shiftMonth } from "@/lib/calendar";
import { dayKey, dayLabel, infoDate } from "@/lib/format";
import { hideCompetition } from "@/app/actions";
import { readHidden } from "@/lib/hidden";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { GameId } from "@/lib/types";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parseGame(v?: string): GameId | undefined {
  return GAME_IDS.find((g) => g === v || GAMES[g].short.toLowerCase() === v?.toLowerCase());
}

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthName = (month: string) => {
  const s = monthFmt.format(new Date(`${month}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`) / 1000;

type Display = "mois" | "semaine";

/** Le lundi de la semaine d'un jour (AAAA-MM-JJ). */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

const dayMonthFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
function weekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const a = dayMonthFmt.format(new Date(`${monday}T12:00:00Z`));
  const b = dayMonthFmt.format(new Date(`${sunday}T12:00:00Z`));
  return `Du ${monday.slice(5, 7) === sunday.slice(5, 7) ? a.split(" ")[0] : a} au ${b}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const now = Date.now() / 1000;
  const today = dayKey(now);
  const mois = first(sp.mois);
  const month = mois && /^\d{4}-\d{2}$/.test(mois) ? mois : today.slice(0, 7);
  const game = parseGame(first(sp.jeu));
  const scope: Scope = first(sp.vue) === "tout" ? "tout" : "mes";
  const display: Display = first(sp.affichage) === "semaine" ? "semaine" : "mois";
  const semaine = first(sp.semaine);
  const week = mondayOf(semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? semaine : today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const href = (patch: { mois?: string; jeu?: GameId | null; vue?: Scope; affichage?: Display; semaine?: string }) => {
    const q = new URLSearchParams();
    const m = patch.mois ?? month;
    const g = patch.jeu === null ? undefined : (patch.jeu ?? game);
    const v = patch.vue ?? scope;
    const a = patch.affichage ?? display;
    const w = patch.semaine ?? week;
    if (a === "semaine") {
      q.set("affichage", "semaine");
      if (w !== mondayOf(today)) q.set("semaine", w);
    } else if (m !== today.slice(0, 7)) q.set("mois", m);
    if (g) q.set("jeu", GAMES[g].short.toLowerCase());
    if (v === "tout") q.set("vue", "tout");
    const s = q.toString();
    return `/calendrier${s ? `?${s}` : ""}`;
  };

  const snap = await loadSnapshot();
  const { matches, competitions, unscheduled } = calendarData(snap, now, scope, game, await readHidden());
  const days = monthGrid(month);
  const visible = competitions.filter((c) => c.end >= days[0] && c.start <= days.at(-1)!);

  const byDay = new Map<string, CalMatch[]>();
  for (const m of matches) byDay.set(m.day, [...(byDay.get(m.day) ?? []), m]);

  // Agenda du mois : chaque jour qui a un match, un début ou une fin de compétition.
  const monthDays = days.filter((d) => d.startsWith(month));
  const agenda = monthDays
    .map((day) => ({
      day,
      matches: byDay.get(day) ?? [],
      starts: competitions.filter((c) => c.start === day),
      ends: competitions.filter((c) => c.end === day && c.end !== c.start),
    }))
    .filter((d) => d.matches.length || d.starts.length || d.ends.length);
  const past = agenda.filter((d) => d.day < today);
  const coming = agenda.filter((d) => d.day >= today);

  const monthMatches = matches.filter((m) => m.day.startsWith(month) && m.ours).length;
  const weekMatches = matches.filter((m) => m.ours && m.day >= week && m.day <= weekDays[6]).length;
  const weekComps = competitions.filter((c) => c.end >= week && c.start <= weekDays[6]).length;
  // Les miennes d'abord : les compétitions surveillées peuvent être nombreuses (tout le S-Tier en CS2).
  const relevanceRank = { confirmed: 0, watched: 1, other: 2 };
  const upcomingComps = competitions
    .filter((c) => c.end >= today)
    .sort((a, b) => relevanceRank[a.relevance] - relevanceRank[b.relevance] || a.start.localeCompare(b.start))
    .slice(0, 16);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "clutch-ochre.vercel.app";
  const icsUrl = `${host}/calendrier.ics`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{display === "semaine" ? weekTitle(week) : monthName(month)}</h1>
          <p className="mt-1 text-sm text-dim">
            {display === "semaine" ? weekMatches : monthMatches} match{(display === "semaine" ? weekMatches : monthMatches) > 1 ? "s" : ""} de
            mes équipes · {display === "semaine" ? weekComps : visible.length} compétition
            {(display === "semaine" ? weekComps : visible.length) > 1 ? "s" : ""}
          </p>
        </div>
        {display === "semaine" ? (
          <nav className="flex items-center gap-1.5" aria-label="Changer de semaine">
            <Link href={href({ semaine: addDays(week, -7) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink" aria-label="Semaine précédente">
              ←
            </Link>
            <Link href={href({ semaine: mondayOf(today) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink">
              Cette semaine
            </Link>
            <Link href={href({ semaine: addDays(week, 7) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink" aria-label="Semaine suivante">
              →
            </Link>
          </nav>
        ) : (
        <nav className="flex items-center gap-1.5" aria-label="Changer de mois">
          <Link href={href({ mois: shiftMonth(month, -1) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink" aria-label="Mois précédent">
            ←
          </Link>
          <Link href={href({ mois: today.slice(0, 7) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink">
            Aujourd&apos;hui
          </Link>
          <Link href={href({ mois: shiftMonth(month, 1) })} className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:border-faint hover:text-ink" aria-label="Mois suivant">
            →
          </Link>
        </nav>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1.5" aria-label="Filtrer par jeu">
          {[undefined, ...GAME_IDS].map((g) => (
            <Link
              key={g ?? "all"}
              href={href({ jeu: g ?? null })}
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
        <div className="flex flex-wrap gap-2">
        <div className="flex rounded-full border border-line p-0.5 text-sm">
          {(
            [
              ["mois", "Mois"],
              ["semaine", "Semaine"],
            ] as const
          ).map(([a, label]) => (
            <Link
              key={a}
              href={href({ affichage: a })}
              className={cn("rounded-full px-3 py-1 transition-colors", display === a ? "bg-panel-2 text-ink" : "text-faint hover:text-dim")}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex rounded-full border border-line p-0.5 text-sm">
          {(
            [
              ["mes", "Mes équipes"],
              ["tout", "Tout le circuit"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={href({ vue: v })}
              className={cn("rounded-full px-3 py-1 transition-colors", scope === v ? "bg-panel-2 text-ink" : "text-faint hover:text-dim")}
            >
              {label}
            </Link>
          ))}
        </div>
        </div>
      </div>

      {display === "semaine" ? (
        <WeekView days={weekDays} today={today} matchesByDay={byDay} competitions={competitions} />
      ) : (
        <MonthGrid month={month} days={days} today={today} matchesByDay={byDay} competitions={visible} />
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={display === "semaine" ? "hidden" : undefined}>
          <SectionTitle>Agenda</SectionTitle>
          {agenda.length === 0 ? (
            <Empty>Rien de prévu ce mois-ci{game ? ` en ${GAMES[game].label}` : ""} pour l&apos;instant.</Empty>
          ) : (
            <div className="space-y-6">
              {past.length > 0 && coming.length > 0 && (
                <details className="rounded-xl border border-line bg-panel">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm text-dim hover:text-ink">
                    Plus tôt ce mois-ci · {past.length} jour{past.length > 1 ? "s" : ""}
                  </summary>
                  <div className="space-y-6 border-t border-line p-4">
                    {past.map((d) => (
                      <AgendaDay key={d.day} {...d} now={now} />
                    ))}
                  </div>
                </details>
              )}
              {(coming.length ? coming : past).map((d) => (
                <AgendaDay key={d.day} {...d} now={now} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-8">
          {unscheduled.length > 0 && (
            <section>
              <SectionTitle>Matchs à programmer</SectionTitle>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {unscheduled.map((u) => (
                  <li key={u.id} data-game={u.game} className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <Logo team={u.teams[0]} size={18} />
                      <span className="shrink-0 font-medium">{u.teams[0]?.short ?? u.teams[0]?.name}</span>
                      <span className="shrink-0 font-display text-xs text-faint">VS</span>
                      <Logo team={u.teams[1]} size={18} />
                      <span className="truncate">{u.teams[1]?.name}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-faint">
                      <GameTag game={u.game} />
                      <span className="truncate">{[u.tournament?.name, u.round].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="mt-1 text-xs text-dim">
                      Date à confirmer
                      {u.span && ` · entre le ${infoDate(u.span.start, now)} et le ${infoDate(u.span.end, now)}`}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle>Prochaines compétitions</SectionTitle>
            {upcomingComps.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {upcomingComps.map((c) => (
                  <UpcomingCompetition key={c.key} c={c} today={today} now={now} />
                ))}
              </ul>
            ) : (
              <Empty>Aucune compétition annoncée.</Empty>
            )}
            {scope === "mes" && (
              <Link href={href({ vue: "tout" })} className="mt-2 block text-xs text-faint hover:text-dim">
                Voir aussi les autres compétitions du circuit →
              </Link>
            )}
          </section>

          <section>
            <SectionTitle>Dans mon agenda</SectionTitle>
            <div className="space-y-3 rounded-xl border border-line bg-panel p-4 text-sm text-dim">
              <p>Les matchs de mes équipes, mis à jour tout seuls dans l&apos;agenda du téléphone.</p>
              <a
                href={`webcal://${icsUrl}`}
                className="block rounded-lg bg-ink px-3 py-2 text-center font-medium text-bg transition-opacity hover:opacity-90"
              >
                S&apos;abonner
              </a>
              <p className="text-xs text-faint">
                Google Agenda : « Autres agendas » → « À partir de l&apos;URL », puis coller{" "}
                <code className="break-all text-dim">https://{icsUrl}</code>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AgendaDay({
  day,
  matches,
  starts,
  ends,
  now,
}: {
  day: string;
  matches: CalMatch[];
  starts: CalCompetition[];
  ends: CalCompetition[];
  now: number;
}) {
  return (
    <section id={`j-${day}`} className="scroll-mt-20">
      <h3 className="mb-2 text-sm font-medium text-dim">{dayLabel(noon(day), now)}</h3>
      {(starts.length > 0 || ends.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {starts.map((c) => (
            <CompetitionPill key={`s-${c.key}`} c={c} label="Début" />
          ))}
          {ends.map((c) => (
            <CompetitionPill key={`e-${c.key}`} c={c} label="Fin" />
          ))}
        </div>
      )}
      {matches.length > 0 && (
        <div className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-panel">
          {[...matches.filter((m) => m.ours), ...matches.filter((m) => !m.ours)].map((m) => (
            <AgendaMatch key={m.id} m={m} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

function CompetitionPill({ c, label }: { c: CalCompetition; label: string }) {
  const { href, external } = competitionLink(c);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-game={c.game}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        c.relevance === "confirmed"
          ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
          : c.relevance === "watched"
            ? "border-dashed border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-dim hover:text-ink"
            : "border-line text-faint hover:text-dim",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="truncate">{c.name}</span>
      {c.relevance === "watched" && <span className="shrink-0 text-faint">· à confirmer</span>}
    </a>
  );
}

function UpcomingCompetition({ c, today, now }: { c: CalCompetition; today: string; now: number }) {
  const { href, external } = competitionLink(c);
  return (
    <li data-game={c.game} className="group relative">
      <UpcomingCompetitionLink c={c} today={today} now={now} href={href} external={external} />
      <form action={hideCompetition} className="absolute bottom-2 right-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <input type="hidden" name="key" value={`${c.game}:${c.page}`} />
        <button className="rounded border border-line bg-panel px-2 py-0.5 text-[11px] text-faint hover:text-ink" title="Masquer cette compétition">
          Masquer
        </button>
      </form>
    </li>
  );
}

function UpcomingCompetitionLink({
  c,
  today,
  now,
  href,
  external,
}: {
  c: CalCompetition;
  today: string;
  now: number;
  href: string;
  external: boolean;
}) {
  const running = c.start <= today;
  const inDays = Math.round((noon(c.start) - noon(today)) / 86400);
  const start = infoDate(c.start, now);
  const end = infoDate(c.end, now);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn("block px-4 py-3 transition-colors hover:bg-panel-2", c.relevance === "other" && "opacity-75")}
    >
      <div className="flex items-center justify-between gap-2">
        <GameTag game={c.game} />
        <span className={cn("text-[11px]", running ? "font-medium text-[var(--accent)]" : "text-faint")}>
          {running
            ? "En cours"
            : inDays === 1
              ? "Demain"
              : inDays > 60
                ? `Dans ${Math.round(inDays / 30)} mois`
                : `Dans ${inDays} j`}
        </span>
      </div>
      <div className="mt-1.5 font-medium leading-snug">{c.name}</div>
      <div className="mt-0.5 text-xs text-faint">
        {[start === end ? start : `${start} → ${end}`, c.location, c.prize].filter(Boolean).join(" · ")}
      </div>
      {c.relevance !== "other" && (
        <div className={cn("mt-1 text-xs", c.relevance === "confirmed" ? "text-[var(--accent)]" : "text-dim")}>
          {RELEVANCE_LABEL[c.relevance]}
        </div>
      )}
    </a>
  );
}
