import Link from "next/link";
import { type Form, ordinal, type PastMatch } from "@/lib/derive";
import { infoDate, money, monthYearOf, placeFr, shortDate, tenure } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { byMap, byPeriod, byTier, formCurve, gamesSummary, type MapTally, recordsOf, type Rival, rivals, type Tally } from "@/lib/stats";
import type { FormerPlayer, GameId, MapSample, Palmares, RankingRow, TeamAward, TeamInfo, TeamRef } from "@/lib/types";
import { FormCurve } from "./FormCurve";
import { cn, Logo, SectionTitle } from "./ui";

const percent = (r: number) => `${Math.round(r * 100)} %`;

function Tile({ label, value, detail, className }: { label: string; value: React.ReactNode; detail?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-line bg-panel px-4 py-3", className)}>
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 break-words font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
      {detail && <div className="text-xs text-faint">{detail}</div>}
    </div>
  );
}

/**
 * Le classement d'une équipe, selon le jeu : la note Liquipedia en Rocket League
 * (la RLCS 2027 n'a pas encore de page de classement), le classement mondial de
 * Valve en CS2, la saison régulière en CDL.
 */
export function rankFigure(game: GameId, info: TeamInfo | undefined, row: RankingRow | undefined): { value: string; detail?: string; rank: number } | undefined {
  if (game === "rocketleague" && info?.lpRank) return { value: ordinal(info.lpRank), detail: info.lpRating ? `note Liquipedia ${info.lpRating}` : "note Liquipedia", rank: info.lpRank };
  if (!row) return undefined;
  const scope = game === "counterstrike" ? "mondial, classement Valve" : "de la saison régulière";
  return { value: ordinal(row.rank), detail: row.points ? `${scope} · ${row.points} pts` : scope, rank: row.rank };
}

/** Carte d'identité : gains, classement, ancienneté du club, palmarès en un coup d'œil, encadrement. */
export function IdentityCard({ info, rank, palmares, now }: { info?: TeamInfo; rank?: { value: string; detail?: string }; palmares?: Palmares; now: number }) {
  const winnings = money(info?.winnings);
  const age = tenure(info?.created, undefined, now);
  const place = [info?.location, info?.region !== info?.location ? info?.region : undefined].filter(Boolean).join(" · ");
  if (!winnings && !rank && !age && !palmares && !info?.staff.length) return null;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {rank && <Tile label="Classement" value={rank.value} detail={rank.detail} />}
        {winnings && <Tile label="Gains totaux" value={winnings} detail="estimation Liquipedia" />}
        {palmares && <Tile label="Titres" value={palmares.titles} detail={`dont ${palmares.majorTitles} en S-Tier`} />}
        {age && <Tile label="Le club existe depuis" value={age} detail={monthYearOf(info?.created)} />}
      </div>
      {(info?.staff.length || place) && (
        <p className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-dim">
          {place && <span>{place}</span>}
          {info?.staff.map((s) => (
            <span key={s.role}>
              <span className="text-faint">{s.role} : </span>
              {s.names.join(", ")}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function RateBar({ rate }: { rate: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-panel-2" aria-hidden>
      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(rate * 100)}%` }} />
    </span>
  );
}

function TallyRow({ label, tally }: { label: string; tally: Tally }) {
  return (
    <tr className="border-t border-line first:border-0">
      <td className="py-2 pl-4 pr-2 text-sm">{label}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right text-sm tabular-nums text-dim">
        {tally.played ? (
          <>
            {tally.wins}
            <span className="text-faint"> V · </span>
            {tally.losses}
            <span className="text-faint"> D</span>
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="w-16 whitespace-nowrap px-2 py-2 text-right font-display text-base font-semibold tabular-nums">{tally.played ? percent(tally.rate) : ""}</td>
      <td className="hidden w-32 py-2 pr-4 sm:table-cell">{tally.played > 0 && <RateBar rate={tally.rate} />}</td>
    </tr>
  );
}

const pluralize = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Bilans, courbe de forme, records et adversaires, calculés sur tout l'historique connu. */
export function TeamStatistics({ results, now, teamHref }: { results: PastMatch[]; now: number; teamHref: (t: TeamRef) => string | undefined }) {
  if (results.length < 3) return null;
  const first = results[results.length - 1];
  const periods = byPeriod(results, now);
  const tiers = byTier(results);
  const records = recordsOf(results);
  const { victims, nemeses } = rivals(results);
  const size = 10;
  const curve = formCurve(results, size);
  const dates = (s?: { from: number; to: number }) => (s ? `${shortDate(s.from, now)} → ${shortDate(s.to, now)}` : undefined);
  return (
    <section className="space-y-3">
      <SectionTitle aside={<span className="text-xs text-faint">{pluralize(results.length, "match")} depuis {shortDate(first.timestamp, now)}</span>}>Statistiques</SectionTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="border-b border-line px-4 py-2 text-xs text-faint">Par période</div>
          <table className="w-full">
            <tbody>
              {periods.map((p) => (
                <TallyRow key={p.label} label={p.label} tally={p.tally} />
              ))}
            </tbody>
          </table>
        </div>
        {tiers.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="border-b border-line px-4 py-2 text-xs text-faint">Par niveau de compétition</div>
            <table className="w-full">
              <tbody>
                {tiers.map((t) => (
                  <TallyRow key={t.tier} label={t.tier === "Qualifier" ? "Qualifications" : t.tier} tally={t.tally} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {curve.length >= 5 && <FormCurve points={curve} window={size} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {records.bestStreak && <Tile label="Meilleure série" value={pluralize(records.bestStreak.count, "victoire")} detail={dates(records.bestStreak)} />}
        {records.worstStreak && <Tile label="Pire série" value={pluralize(records.worstStreak.count, "défaite")} detail={dates(records.worstStreak)} />}
        {records.seriesPlayed > 0 && <Tile label="Balayages" value={records.sweeps} detail={`${records.sweptBy} subis · sur ${pluralize(records.seriesPlayed, "série")}`} />}
        {records.deciders > 0 && <Tile label="Manches décisives" value={percent(records.decidersWon / records.deciders)} detail={`${records.decidersWon} gagnées sur ${records.deciders}`} />}
      </div>

      {(victims.length > 0 || nemeses.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <RivalList title="Victimes préférées" rivals={victims} teamHref={teamHref} />
          <RivalList title="Bêtes noires" rivals={nemeses} teamHref={teamHref} />
        </div>
      )}
    </section>
  );
}

function RivalList({ title, rivals: list, teamHref }: { title: string; rivals: Rival[]; teamHref: (t: TeamRef) => string | undefined }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="border-b border-line px-4 py-2 text-xs text-faint">{title}, à partir de 3 matchs</div>
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((r) => {
            const href = teamHref(r.opponent);
            return (
              <li key={r.opponent.page ?? r.opponent.name} className="flex items-center gap-2 px-4 py-2 text-sm">
                <Logo team={r.opponent} size={18} />
                {href ? (
                  <Link href={href} className="min-w-0 flex-1 truncate hover:underline">
                    {r.opponent.name}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{r.opponent.name}</span>
                )}
                <span className="whitespace-nowrap text-xs tabular-nums text-faint">
                  {r.tally.wins} V · {r.tally.losses} D
                </span>
                <span className="w-12 text-right font-display font-semibold tabular-nums">{percent(r.tally.rate)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-faint">Personne pour l&apos;instant.</p>
      )}
    </div>
  );
}

const fmtAvg = (n: number) => n.toFixed(1).replace(".", ",");

function MapTable({ title, groups, unit }: { title: string; groups: MapTally[]; unit?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="border-b border-line px-4 py-2 text-xs text-faint">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {groups.map((m) => (
            <tr key={m.map} className="border-t border-line first:border-0">
              <td className="max-w-40 truncate py-2 pl-4 pr-2">{m.map}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-dim">
                {m.wins}
                <span className="text-faint"> / {m.played}</span>
              </td>
              <td className="w-16 whitespace-nowrap px-2 py-2 text-right font-display text-base font-semibold tabular-nums">{percent(m.rate)}</td>
              <td className="hidden w-24 py-2 pr-2 sm:table-cell">
                <RateBar rate={m.rate} />
              </td>
              {unit && (
                <td className="hidden whitespace-nowrap py-2 pr-4 text-right text-xs tabular-nums text-faint sm:table-cell" title={`${unit} marqués et encaissés, en moyenne par manche`}>
                  {fmtAvg(m.forAvg)} – {fmtAvg(m.againstAvg)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Manches, selon le jeu : cartes en CS2, modes et cartes en CDL, buts et arènes en Rocket League. */
export function GamesStats({ samples, game, now }: { samples: MapSample[]; game: GameId; now: number }) {
  const summary = gamesSummary(samples);
  if (!summary) return null;
  const since = Math.min(...samples.map((s) => s.at));
  const rocket = game === "rocketleague";
  const cod = game === "callofduty";
  const maps = byMap(samples);
  const modes = byMap(samples.flatMap((s) => (s.mode ? [{ ...s, map: s.mode }] : [])));
  // Un meilleur ou un pire score n'a de sens qu'avec quelques manches : à partir de 3.
  const ranked = maps.filter((m) => m.played >= 3).sort((a, b) => b.rate - a.rate || b.played - a.played);
  const [best, worst] = [ranked[0], ranked.length > 1 ? ranked[ranked.length - 1] : undefined];
  const title = rocket ? "Manches et arènes" : cod ? "Modes et cartes" : "Cartes";
  return (
    <section className="space-y-3">
      <SectionTitle aside={<span className="text-xs text-faint">{pluralize(summary.played, "manche")} depuis {shortDate(since, now)}</span>}>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Manches gagnées" value={percent(summary.rate)} detail={`${summary.wins} sur ${summary.played}`} className="col-span-2 lg:col-span-1" />
        {rocket ? (
          <>
            <Tile label="Buts marqués par manche" value={fmtAvg(summary.forAvg)} />
            <Tile label="Buts encaissés par manche" value={fmtAvg(summary.againstAvg)} />
          </>
        ) : (
          <>
            {best && <Tile label="Meilleure carte" value={best.map} detail={`${percent(best.rate)} sur ${pluralize(best.played, "manche")}`} />}
            {worst && <Tile label="Carte la moins réussie" value={worst.map} detail={`${percent(worst.rate)} sur ${pluralize(worst.played, "manche")}`} />}
          </>
        )}
      </div>
      {(modes.length > 0 || maps.length > 0) && (
        <div className={cn("grid gap-3", modes.length > 0 && maps.length > 0 && "lg:grid-cols-2")}>
          {modes.length > 0 && <MapTable title="Par mode" groups={modes} unit="Points" />}
          {/* En CDL, une moyenne par carte mélangerait des modes aux barèmes sans rapport. */}
          {maps.length > 0 && <MapTable title={rocket ? "Par arène" : "Par carte"} groups={maps.slice(0, 12)} unit={rocket ? "Buts" : cod ? undefined : "Rounds"} />}
        </div>
      )}
    </section>
  );
}

const placeColor = (rank?: number) => (rank === 1 ? "text-[var(--accent)]" : rank && rank <= 3 ? "text-ink" : "text-dim");

/** Palmarès : le décompte, puis les compétitions récentes, le reste à déplier. */
export function PalmaresCard({ palmares, wiki, now }: { palmares: Palmares; wiki: GameId; now: number }) {
  const row = (r: Palmares["rows"][number], i: number) => (
    <li key={i} className="grid grid-cols-[3.5rem_4rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 text-sm">
      <span className="text-xs text-faint">{r.date ? infoDate(r.date, now) : "—"}</span>
      <span className={cn("whitespace-nowrap font-display font-semibold", placeColor(r.rank))}>{placeFr(r.place)}</span>
      <span className="min-w-0">
        {r.tournament.page ? (
          <a href={`https://liquipedia.net/${wiki}/${pageToPath(r.tournament.page)}`} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:underline sm:truncate">
            {r.tournament.name}
          </a>
        ) : (
          <span className="line-clamp-2 sm:truncate">{r.tournament.name}</span>
        )}
        {r.tier && <span className="text-xs text-faint">{r.tier}</span>}
      </span>
      <span className="whitespace-nowrap text-right text-xs tabular-nums text-dim">{money(r.prize)}</span>
    </li>
  );
  return (
    <section className="space-y-3">
      <SectionTitle aside={<span className="text-xs text-faint">{pluralize(palmares.events, "compétition")}</span>}>Palmarès</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Titres" value={palmares.titles} />
        <Tile label="En S-Tier" value={palmares.majorTitles} />
        <Tile label="Finales perdues" value={palmares.finals} />
        <Tile label="Podiums" value={palmares.podiums} />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <ul className="divide-y divide-line">{palmares.rows.slice(0, 8).map(row)}</ul>
        {palmares.rows.length > 8 && (
          <details className="group border-t border-line">
            <summary className="cursor-pointer px-4 py-2 text-xs text-faint hover:text-dim">Voir les {palmares.rows.length - 8} suivantes</summary>
            <ul className="divide-y divide-line border-t border-line">{palmares.rows.slice(8).map((r, i) => row(r, i + 8))}</ul>
          </details>
        )}
      </div>
    </section>
  );
}

/** Anciens joueurs : leur passage au club, et où ils sont partis. */
export function FormerRoster({ players, now }: { players: FormerPlayer[]; now: number }) {
  if (!players.length) return null;
  return (
    <section>
      <SectionTitle>Anciens joueurs</SectionTitle>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {players.map((p) => (
          <li key={`${p.id}-${p.joined}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{p.id}</span>
              {p.name && <span className="ml-2 text-faint">{p.name}</span>}
            </span>
            {p.next && <span className="text-xs text-dim">→ {p.next === "Retired" ? "Retraite" : p.next}</span>}
            <span className="w-full text-xs text-faint sm:w-auto">
              {[p.left && `parti le ${infoDate(p.left, now)}`, tenure(p.joined, p.left, now) && `resté ${tenure(p.joined, p.left, now)}`].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Distinctions et faits marquants. Liquipedia ne publie pas de statistiques
 * chiffrées par joueur pour ces jeux : ce sont les seules données individuelles.
 */
export function Honors({ awards, records, now }: { awards: TeamAward[]; records: string[]; now: number }) {
  if (!awards.length && !records.length) return null;
  return (
    <section>
      <SectionTitle>Distinctions</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        {awards.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {awards.map((a, i) => (
              <li key={i} className="px-4 py-2.5 text-sm">
                <span className="font-medium">{a.player ?? a.award}</span>
                {a.player && <span className="ml-2 text-dim">{a.award}</span>}
                {(a.tournament || a.date) && <span className="block text-xs text-faint">{[a.date && infoDate(a.date, now), a.tournament].filter(Boolean).join(" · ")}</span>}
              </li>
            ))}
          </ul>
        )}
        {records.length > 0 && (
          <ul className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm text-dim">
            {records.map((r, i) => (
              <li key={i} className="border-l-2 border-[color-mix(in_srgb,var(--accent)_50%,transparent)] pl-3 leading-snug">
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


interface DuelSide {
  team: TeamRef | null;
  info?: TeamInfo;
  rank?: { value: string; rank: number };
  form?: Form;
}

const streakText = (form?: Form) => {
  const s = form?.streak;
  if (!s) return undefined;
  return s.result === "win" ? pluralize(s.count, "victoire") : s.result === "loss" ? pluralize(s.count, "défaite") : pluralize(s.count, "nul");
};
const amount = (info?: TeamInfo) => {
  const n = Number(info?.winnings?.replace(/[^\d]/g, ""));
  return n > 0 ? n : undefined;
};
const year = (info?: TeamInfo) => info?.created?.slice(0, 4);

/** Une ligne du duel. `us`/`them` servent à repérer l'avantage quand les chiffres se comparent. */
interface DuelLine {
  label: string;
  left?: string;
  right?: string;
  us?: number;
  them?: number;
}

/** Les chiffres des deux équipes, face à face. Masqué tant qu'aucune ligne n'a ses deux côtés. */
export function Duel({ us, them }: { us: DuelSide; them: DuelSide }) {
  const [usWon, themWon] = [us.form?.wins, them.form?.wins];
  const [usSize, themSize] = [us.form?.last.length, them.form?.last.length];
  const lines: DuelLine[] = [
    // Un rang bas est un avantage : on compare son opposé.
    { label: "Classement", left: us.rank?.value, right: them.rank?.value, us: us.rank && -us.rank.rank, them: them.rank && -them.rank.rank },
    { label: "Gains totaux", left: money(us.info?.winnings), right: money(them.info?.winnings), us: amount(us.info), them: amount(them.info) },
    { label: "Victoires, 10 derniers matchs", left: usWon !== undefined && usSize ? `${usWon} sur ${usSize}` : undefined, right: themWon !== undefined && themSize ? `${themWon} sur ${themSize}` : undefined, us: usSize === themSize ? usWon : undefined, them: usSize === themSize ? themWon : undefined },
    { label: "Série en cours", left: streakText(us.form), right: streakText(them.form) },
    { label: "Club créé en", left: year(us.info), right: year(them.info) },
  ];
  const shown = lines.filter((l) => l.left || l.right);
  if (!lines.some((l) => l.left && l.right)) return null;
  const strong = (mine?: number, other?: number) => (mine !== undefined && other !== undefined && mine > other ? "font-semibold text-ink" : "text-dim");
  return (
    <section>
      <SectionTitle>Le duel</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line px-4 py-2.5 text-sm font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <Logo team={us.team} size={20} />
            <span className="truncate">{us.team?.short ?? us.team?.name}</span>
          </span>
          <span />
          <span className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate">{them.team?.short ?? them.team?.name ?? "À déterminer"}</span>
            <Logo team={them.team} size={20} />
          </span>
        </div>
        <dl className="divide-y divide-line">
          {shown.map((l) => (
            <div key={l.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-3 px-4 py-2 text-sm tabular-nums">
              <dd className={strong(l.us, l.them)}>{l.left ?? "—"}</dd>
              <dt className="text-center text-xs text-faint">{l.label}</dt>
              <dd className={cn("text-right", strong(l.them, l.us))}>{l.right ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
