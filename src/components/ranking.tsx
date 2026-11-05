import { isTeam, ordinal } from "@/lib/derive";
import { infoDate } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import type { FollowedTeam } from "@/config/follow";
import type { Ranking, RankingRow } from "@/lib/types";
import { cn, Logo } from "./ui";

const tint = "bg-[color-mix(in_srgb,var(--accent)_11%,transparent)]";

/**
 * Le classement de saison vu d'une équipe : sa place en tête, puis le haut du
 * tableau (10 premiers), et sa ligne à part si elle est plus loin.
 */
export function RankingCard({ ranking, team, now }: { ranking: Ranking; team: FollowedTeam; now: number }) {
  const mine = ranking.rows.find((r) => isTeam(r.team, team));
  const top = ranking.rows.filter((r) => r.rank <= 10);
  const vrs = ranking.wiki === "counterstrike";
  const updated = ranking.updated ? infoDate(ranking.updated, now) : undefined;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <div className="text-sm">
          {mine ? (
            <>
              <b className="font-display text-2xl text-ink">{ordinal(mine.rank)}</b>
              <span className="ml-1.5 text-dim">{vrs ? "mondial" : "de la saison régulière"}</span>
              {mine.regionRank !== undefined && (
                <span className="text-dim">
                  {" · "}
                  {ordinal(mine.regionRank)} en {mine.regionName === "Americas" ? "Amériques" : mine.regionName === "Asia" ? "Asie" : mine.regionName}
                </span>
              )}
              {mine.points && <span className="text-dim"> · {mine.points} pts</span>}
            </>
          ) : (
            <span className="text-dim">{team.page} n&apos;y figure pas.</span>
          )}
        </div>
        <a
          href={`https://liquipedia.net/${ranking.wiki}/${pageToPath(ranking.page)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-faint hover:text-dim"
        >
          {ranking.title}
          {updated ? `, au ${updated}` : ""} ↗
        </a>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-faint">
            <th className="w-10 py-2 pl-4 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Équipe</th>
            {vrs ? (
              <th className="py-2 pr-4 text-right font-medium">Points</th>
            ) : (
              ranking.columns.map((c) => (
                <th key={c} className="hidden py-2 pr-3 text-right font-medium sm:table-cell last:pr-4">
                  {c}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {top.map((r) => (
            <Row key={r.rank} row={r} ranking={ranking} ours={isTeam(r.team, team)} />
          ))}
          {mine && mine.rank > 10 && (
            <>
              <tr aria-hidden>
                <td colSpan={2 + (vrs ? 1 : ranking.columns.length)} className="py-1 text-center text-faint">
                  ⋯
                </td>
              </tr>
              <Row row={mine} ranking={ranking} ours />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, ranking, ours }: { row: RankingRow; ranking: Ranking; ours: boolean }) {
  const vrs = ranking.wiki === "counterstrike";
  return (
    <tr className={cn(ours && tint)}>
      <td className="py-2 pl-4 font-display font-semibold tabular-nums text-dim">{row.rank}</td>
      <td className="py-2">
        <span className="flex min-w-0 items-center gap-2">
          <Logo team={row.team} size={18} />
          <span className={cn("truncate", ours && "font-semibold text-[var(--accent)]")}>{row.team.name}</span>
          {vrs && row.region && <span className="text-[11px] text-faint">{row.region}</span>}
        </span>
      </td>
      {vrs ? (
        <td className="py-2 pr-4 text-right tabular-nums text-dim">{row.points}</td>
      ) : (
        ranking.columns.map((c, i) => (
          <td key={c} className={cn("hidden py-2 pr-3 text-right tabular-nums sm:table-cell last:pr-4", /pts|points/i.test(c) ? "font-semibold text-ink" : "text-dim")}>
            {row.cells?.[i]}
          </td>
        ))
      )}
    </tr>
  );
}
