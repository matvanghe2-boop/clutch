import Link from "next/link";
import type { FollowedTeam } from "@/config/follow";
import { isTeam, matchHref, statusOf, teamLink } from "@/lib/derive";
import { matchMorph } from "@/lib/morph-attrs";
import { matchStreams } from "@/lib/streams";
import { clock, dayKey, dayLabel, shortDate, shortDay } from "@/lib/format";
import { bracketLayout } from "@/lib/bracket";
import type { BracketNode, BracketSection, Match, Matchlist, StandingRow, StandingTable, SwissRound, TeamRef } from "@/lib/types";
import { BracketHover } from "./Motion";
import { cn, LiveBadge, Logo, StreamLinks } from "./ui";

const tint = "bg-[color-mix(in_srgb,var(--accent)_11%,transparent)]";

const STATUS_BAR: Record<NonNullable<StandingRow["status"]>, string> = {
  up: "bg-win",
  stayup: "bg-win/50",
  stay: "bg-faint/50",
  staydown: "bg-loss/50",
  down: "bg-loss",
  draw: "bg-faint/50",
};

const HEADER_FR: Record<string, string> = { Match: "Matchs", Game: "Manches", GD: "+/−", Round: "Rounds", BH: "BH", Points: "Pts", Pts: "Pts" };

function RoundChip({ r }: { r: SwissRound }) {
  const color = r.result === "win" ? "border-win" : r.result === "loss" ? "border-loss" : "border-line";
  return (
    <span
      className={cn("grid size-6 place-items-center rounded border-b-2 bg-panel-2", color)}
      title={[r.opponent?.name, r.score].filter(Boolean).join(" · ")}
    >
      {r.opponent ? <Logo team={r.opponent} size={14} /> : null}
    </span>
  );
}

export function GroupTableView({ table, team }: { table: StandingTable; team: FollowedTeam }) {
  const swiss = table.rows.some((r) => r.rounds?.length);
  const numeric = Math.max(0, ...table.rows.map((r) => r.cells.length));
  return (
    <div className="overflow-hidden panel">
      <div className="border-b border-line px-4 py-2.5 font-display font-semibold tracking-wide">{table.title}</div>
      {/* Largeurs fixes : la colonne équipe prend tout le reste, quel que soit le nombre de colonnes. */}
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-11" />
          <col />
          {Array.from({ length: numeric }, (_, i) => (
            <col key={i} className={i === 0 ? "w-14" : "w-[4.5rem]"} />
          ))}
          {swiss && <col className="w-0 sm:w-40" />}
        </colgroup>
        {table.headers && table.headers.length > 0 && (
          <thead>
            <tr className="border-b border-line/60 text-[11px] uppercase tracking-wider text-faint">
              <th />
              <th />
              {table.headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-right font-medium last:pr-4">
                  {HEADER_FR[h] ?? h}
                </th>
              ))}
              {swiss && <th className="hidden px-2 pr-4 text-left font-medium sm:table-cell">Parcours</th>}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((r, i) => {
            const ours = isTeam(r.team, team);
            return (
              <tr key={i} className={cn("border-b border-line/60 last:border-0", ours && tint)}>
                <td className="relative py-2 pl-4 font-display text-faint">
                  {r.status && <span className={cn("absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r", STATUS_BAR[r.status])} />}
                  {r.rank}
                </td>
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-2">
                    <Logo team={r.team} size={20} />
                    <TeamName wiki={team.game} team={r.team} followed={team} className={cn("truncate", ours && "font-semibold text-[var(--accent)]")} />
                  </span>
                </td>
                {r.cells.map((c, j) => (
                  <td
                    key={j}
                    className={cn("whitespace-nowrap px-2 text-right tabular-nums last:pr-4", j === 0 ? "font-display text-base font-semibold" : "text-dim")}
                  >
                    {c}
                  </td>
                ))}
                {swiss && (
                  <td className="hidden py-1.5 pl-2 pr-4 sm:table-cell">
                    <span className="flex gap-1">
                      {(r.rounds ?? []).map((round, k) => (
                        <RoundChip key={k} r={round} />
                      ))}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Nom d'équipe cliquable : la page de l'équipe suivie, ou la fiche des autres.
 * Il passe au-dessus du lien étiré d'un match (`relative z-10`) : on ouvre
 * l'équipe en cliquant sur son nom, la feuille de match partout ailleurs.
 */
function TeamName({ wiki, team, followed, className }: { wiki: FollowedTeam["game"]; team: TeamRef | null; followed: FollowedTeam; className?: string }) {
  const href = teamLink(wiki, team, followed);
  const label = team?.name ?? "À déterminer";
  return href ? (
    <Link href={href} className={cn("relative z-10 hover:underline", className)}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}

/** Toute la surface d'un match de mon équipe mène à sa feuille de match. */
function MatchOverlay({ m, label }: { m: Match; label: string }) {
  return <Link href={matchHref(m)} className="absolute inset-0" aria-label={label} />;
}

function Side({ team, score, won, decided, ours, followed }: { team: TeamRef | null; score: string | null; won: boolean; decided: boolean; ours: boolean; followed: FollowedTeam }) {
  return (
    <div data-team={team?.page ?? team?.name} data-won={won ? "" : undefined} data-ours={ours ? "" : undefined} className={cn("bk-side flex h-9 items-center gap-2 px-2.5 transition-colors", ours && tint)}>
      <Logo team={team} size={20} />
      <span className="flex min-w-0 flex-1">
        <TeamName
          wiki={followed.game}
          team={team}
          followed={followed}
          className={cn("truncate", !team && "italic text-faint", decided && !won && "text-faint", won && "font-semibold", ours && "text-[var(--accent)]")}
        />
      </span>
      <span className={cn("score w-6 text-right text-xl", decided && !won && "text-faint")}>{score ?? ""}</span>
    </div>
  );
}

export function BracketMatch({ m, team, now, column = 0, heat }: { m: Match; team: FollowedTeam; now: number; column?: number; heat?: Heat }) {
  const ours = m.opponents.some((o) => isTeam(o, team));
  const st = statusOf(m, now);
  return (
    <div
      data-ours={ours ? "" : undefined}
      data-heat={heat}
      style={{ "--c": column } as React.CSSProperties}
      {...(ours ? matchMorph(m, m.opponents[0], m.opponents[1], st) : {})}
      className={cn("bk-card", ours && "lift", st === "live" && "live-ring")}
    >
      {ours && <MatchOverlay m={m} label="Feuille de match" />}
      {[0, 1].map((i) => (
        <div key={i} className={i === 0 ? "border-b border-line" : undefined}>
          <Side team={m.opponents[i]} score={m.scores[i]} won={m.winner === i + 1} decided={m.winner !== undefined} ours={isTeam(m.opponents[i], team)} followed={team} />
        </div>
      ))}
      <div className="flex min-h-6 items-center justify-between gap-2 border-t border-line px-2 py-1 text-[11px] text-faint">
        {st === "live" ? (
          <LiveBadge />
        ) : m.timestamp ? (
          <span className="truncate">
            {st === "done" ? shortDate(m.timestamp, now) : shortDay(m.timestamp, now)} ·{" "}
            <span className={st === "done" ? undefined : "font-semibold text-ink"}>{m.timeTbd ? "heure à conf." : clock(m.timestamp)}</span>
          </span>
        ) : (
          <span>{st === "done" ? "" : "Horaire à venir"}</span>
        )}
        {ours ? <span className="shrink-0 text-[var(--accent)]">Feuille →</span> : m.bestOf && <span className="shrink-0">Bo{m.bestOf}</span>}
      </div>
    </div>
  );
}

/** Largeur d'une colonne de bracket : un match (w-56) et son raccord (1,75 rem). */
const COLUMN_REM = 14 + 1.75;

/** Le parcours qu'une liaison porte : celui de mon équipe, ou celui du vainqueur final. */
type Heat = "ours" | "gold";

function winnerOf(m: Match | null): TeamRef | null {
  return m?.winner ? m.opponents[m.winner - 1] : null;
}

const sameTeam = (a: TeamRef | null, b: TeamRef | null) => Boolean(a && b && (a.page ?? a.name) === (b.page ?? b.name));

/** Le vainqueur de ce match continue-t-il un parcours à éclairer ? */
function heatOf(m: Match | null, team: FollowedTeam, champion: TeamRef | null): Heat | undefined {
  const w = winnerOf(m);
  if (!w) return undefined;
  if (isTeam(w, team)) return "ours";
  return sameTeam(w, champion) ? "gold" : undefined;
}

/** Le tour d'un match, en partant de la gauche : c'est lui qui règle la cascade et la lumière. */
function columnOf(node: BracketNode): number {
  return node.children.reduce((best, c) => Math.max(best, columnOf(c) + 1 + (c.skip ?? 0)), 0);
}

/** Colonnes sautées entre un match et son parent : le trait les traverse. */
function Gap({ columns, column, heat }: { columns: number; column: number; heat?: Heat }) {
  return (
    <div className="bk-link" style={{ width: `${columns * COLUMN_REM}rem`, "--c": column } as React.CSSProperties} aria-hidden>
      <i className="bk-line bk-h inset-x-0 top-1/2" data-heat={heat} style={{ "--s": 3 } as React.CSSProperties} />
    </div>
  );
}

/**
 * Relie les enfants (centrés dans des lignes de même hauteur) au match parent. Une liaison par
 * enfant, chacune en deux morceaux : le morceau du parcours éclairé s'allume seul.
 */
function Connector({ heats, column }: { heats: (Heat | undefined)[]; column: number }) {
  const count = heats.length;
  const out = heats.find(Boolean);
  return (
    <div className="bk-link" style={{ "--c": column } as React.CSSProperties} aria-hidden>
      {count > 1 &&
        heats.map((heat, i) => {
          const y = ((2 * i + 1) / (2 * count)) * 100;
          return (
            <span key={i}>
              <i className="bk-line bk-h left-0 w-1/2" data-heat={heat} style={{ top: `${y}%`, "--s": 0 } as React.CSSProperties} />
              <i className="bk-line bk-v left-1/2" data-heat={heat} data-dir={y < 50 ? "down" : "up"} style={{ top: `${Math.min(y, 50)}%`, height: `${Math.abs(50 - y)}%`, "--s": 1 } as React.CSSProperties} />
            </span>
          );
        })}
      <i className={cn("bk-line bk-h right-0 top-1/2", count > 1 ? "left-1/2" : "left-0")} data-heat={out} style={{ "--s": 2 } as React.CSSProperties} />
    </div>
  );
}

function NodeView({ node, team, now, champion }: { node: BracketNode; team: FollowedTeam; now: number; champion: TeamRef | null }) {
  const column = columnOf(node);
  return (
    <div className="flex items-center">
      {node.children.length > 0 && (
        <>
          <div className="grid auto-rows-fr">
            {node.children.map((c, i) => (
              // Un sous-arbre plus court se range contre le match parent : les colonnes restent alignées sur les tours.
              <div key={i} className="flex items-center justify-end py-1.5">
                <NodeView node={c} team={team} now={now} champion={champion} />
                {c.skip ? <Gap columns={c.skip} column={column - 1} heat={heatOf(c.match, team, champion)} /> : null}
              </div>
            ))}
          </div>
          <Connector heats={node.children.map((c) => heatOf(c.match, team, champion))} column={column - 1} />
        </>
      )}
      <div className="w-56 shrink-0">
        {node.match ? (
          <BracketMatch m={node.match} team={team} now={now} column={column} heat={heatOf(node.match, team, champion)} />
        ) : node.qualified ? (
          <QualifiedCard teams={node.qualified} team={team} column={column} />
        ) : (
          <div className="bk-card h-16 border-dashed" style={{ "--c": column } as React.CSSProperties} />
        )}
      </div>
    </div>
  );
}

function QualifiedCard({ teams, team, column = 0, heat }: { teams: (TeamRef | null)[]; team: FollowedTeam; column?: number; heat?: Heat }) {
  return (
    <div className="bk-card" data-heat={heat} style={{ "--c": column } as React.CSSProperties}>
      {teams.map((t, i) => (
        <div key={i} className={cn("flex h-9 items-center gap-2 px-2.5", i > 0 && "border-t border-line", isTeam(t, team) && cn(tint, "text-[var(--accent)]"))}>
          <Logo team={t} size={20} />
          <span className={cn("truncate", !t && "italic text-faint")}>{t?.name ?? "À déterminer"}</span>
        </div>
      ))}
    </div>
  );
}

export function BracketSectionView({ section, team, now }: { section: BracketSection; team: FollowedTeam; now: number }) {
  const { width, rootWidths, columns, trailing } = bracketLayout(section);
  // Colonne finale « Qualified » : pas un nœud de l'arbre, on y montre le vainqueur de chaque racine.
  const headers = columns ? [...columns, ...(trailing ? [trailing] : [])] : [];
  return (
    <div className="scrollbar-thin overflow-x-auto pb-2">
      <BracketHover>
      <div className="inline-block min-w-full">
        {headers.length > 0 && (
          <div className="mb-2 flex">
            {headers.map((h, i) => (
              <div key={i} className={cn("display shrink-0 truncate text-sm tracking-wider text-dim", i === 0 ? "w-56" : "ml-7 w-56")} title={h ?? undefined}>
                {h}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {section.roots.map((root, i) => {
            const champion = winnerOf(root.match);
            const column = columnOf(root) + 1;
            const heat = heatOf(root.match, team, champion);
            return (
              // Un arbre plus court que ses voisins se cale à droite, sous les bons en-têtes.
              <div key={i} className="flex items-center" style={{ marginLeft: `${(width - rootWidths[i]) * COLUMN_REM}rem` }}>
                <NodeView node={root} team={team} now={now} champion={champion} />
                {trailing && (
                  <>
                    <Connector heats={[heat]} column={column - 1} />
                    <div className="w-56 shrink-0">
                      <QualifiedCard teams={[champion]} team={team} column={column} heat={heat} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </BracketHover>
    </div>
  );
}

function ListMatch({ m, team, now, inDay, caption }: { m: Match; team: FollowedTeam; now: number; inDay?: boolean; caption?: string }) {
  const st = statusOf(m, now);
  const ours = m.opponents.some((o) => isTeam(o, team));
  const side = (i: 0 | 1) => {
    const t = m.opponents[i];
    const lost = m.winner !== undefined && m.winner !== i + 1;
    return (
      <span className={cn("flex min-w-0 items-center gap-2", i === 0 && "flex-row-reverse text-right")}>
        <Logo team={t} size={20} />
        <TeamName
          wiki={team.game}
          team={t}
          followed={team}
          className={cn("truncate", lost && "text-faint", isTeam(t, team) && "font-semibold text-[var(--accent)]", !t && "italic text-faint")}
        />
      </span>
    );
  };
  return (
    <div
      className={cn(
        "row-hover relative grid grid-cols-[3.75rem_1fr_auto_1fr] items-center gap-3 px-3 py-2 text-sm sm:grid-cols-[5.5rem_1fr_auto_1fr] sm:px-4",
        ours && cn(tint, "transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"),
      )}
    >
      {ours && <MatchOverlay m={m} label="Feuille de match" />}
      <span className="text-[11px] leading-tight text-faint">
        {st === "live" ? (
          <LiveBadge />
        ) : m.timestamp && inDay ? (
          // Le jour est dans l'intertitre : l'heure seule, bien lisible.
          m.timeTbd ? (
            "heure à conf."
          ) : (
            <b className="score text-xl text-ink">{clock(m.timestamp)}</b>
          )
        ) : m.timestamp ? (
          <>
            {st === "done" ? shortDate(m.timestamp, now) : shortDay(m.timestamp, now)}
            <br />
            <span className={st === "done" ? undefined : "font-semibold text-ink"}>{m.timeTbd ? "heure à conf." : clock(m.timestamp)}</span>
          </>
        ) : st === "done" ? (
          "—"
        ) : (
          <>
            Horaire
            <br />à venir
          </>
        )}
      </span>
      {side(0)}
      <span className="score min-w-12 text-center text-2xl">
        {m.scores[0] !== null || m.scores[1] !== null ? (
          <>
            <span className={m.winner === 2 ? "text-faint" : undefined}>{m.scores[0] ?? 0}</span>
            <span className="px-1 text-faint">–</span>
            <span className={m.winner === 1 ? "text-faint" : undefined}>{m.scores[1] ?? 0}</span>
          </>
        ) : (
          <span className="text-sm text-faint">{m.bestOf ? `Bo${m.bestOf}` : "vs"}</span>
        )}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        {side(1)}
        {st !== "done" && (
          <span className="relative z-10 shrink-0">
            <StreamLinks streams={ours ? matchStreams(team, m.streams) : m.streams} compact max={1} />
          </span>
        )}
      </span>
      {caption && <span className="col-start-2 col-end-5 -mt-1.5 truncate text-center text-[11px] text-faint">{caption}</span>}
    </div>
  );
}

/**
 * Le programme de la compétition : ses prochains matchs, jour par jour, à l'heure
 * de Paris. Un match dont aucune équipe n'est connue et sans horaire n'apprend
 * rien : il reste dans le bracket.
 */
export function ScheduleView({ matches, team, now, onlyOurs }: { matches: Match[]; team: FollowedTeam; now: number; onlyOurs: boolean }) {
  const planned = matches
    .filter((m) => {
      const st = statusOf(m, now);
      if (st !== "upcoming" && st !== "live") return false;
      if (onlyOurs && !m.opponents.some((o) => isTeam(o, team))) return false;
      return m.timestamp !== undefined || m.opponents.some(Boolean);
    })
    .sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity))
    .slice(0, 40);
  if (!planned.length) return null;
  const days: { key: string; label: string; matches: Match[] }[] = [];
  for (const m of planned) {
    const key = m.timestamp === undefined ? "?" : dayKey(m.timestamp);
    const last = days.at(-1);
    if (last?.key === key) last.matches.push(m);
    else days.push({ key, label: m.timestamp === undefined ? "Horaire à venir" : dayLabel(m.timestamp, now), matches: [m] });
  }
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="section-title">Programme</h2>
        <span className="text-xs text-faint">à l&apos;heure de Paris</span>
      </div>
      <div className="overflow-hidden panel">
        {days.map((d) => (
          <div key={d.key}>
            <div className="border-b border-line bg-panel-2 px-4 py-1.5 text-xs font-medium text-dim">{d.label}</div>
            <div className="divide-y divide-line/50">
              {d.matches.map((m) => (
                <ListMatch key={m.id} m={m} team={team} now={now} inDay caption={[m.tournament?.anchor, m.round].filter(Boolean).join(" · ") || undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MatchlistView({ list, team, now, onlyOurs }: { list: Matchlist; team: FollowedTeam; now: number; onlyOurs: boolean }) {
  const matches = onlyOurs ? list.matches.filter((m) => m.opponents.some((o) => isTeam(o, team))) : list.matches;
  if (!matches.length) return null;
  const open = matches.some((m) => m.opponents.some((o) => isTeam(o, team)) || statusOf(m, now) !== "done");
  const rounds: [string | undefined, Match[]][] = [];
  for (const m of matches) {
    const last = rounds.at(-1);
    if (last && last[0] === m.round) last[1].push(m);
    else rounds.push([m.round, [m]]);
  }
  return (
    <details open={open} className="group overflow-hidden panel">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 hover:bg-panel-2">
        <span className="display text-lg">{list.title}</span>
        <span className="flex items-center gap-2 text-xs text-faint">
          {matches.length} match{matches.length > 1 ? "s" : ""}
          <span className="transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="border-t border-line">
        {rounds.map(([round, ms], i) => (
          <div key={i}>
            {round && round !== list.title && <div className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">{round}</div>}
            <div className="divide-y divide-line/50">
              {ms.map((m) => (
                <ListMatch key={m.id} m={m} team={team} now={now} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
