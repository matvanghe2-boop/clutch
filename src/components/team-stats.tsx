import Link from "next/link";
import { type Form, ordinal, type PastMatch } from "@/lib/derive";
import { type Era, titlesIn } from "@/lib/eras";
import { infoDate, money, monthYearOf, placeFr, shortDate, tenure } from "@/lib/format";
import { pageToPath } from "@/lib/liquipedia/html";
import { byMap, byPeriod, byTier, formCurve, gamesSummary, type MapTally, recordsOf, type Rival, rivals, type Tally, tally } from "@/lib/stats";
import type { FormerPlayer, GameId, MapSample, Palmares, RankingRow, TeamAward, TeamInfo, TeamRef } from "@/lib/types";
import { FormCurve } from "./FormCurve";
import { cn, Logo, Num, SectionTitle } from "./ui";

const percent = (r: number) => `${Math.round(r * 100)} %`;

function Tile({ label, value, detail, className }: { label: string; value: React.ReactNode; detail?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("panel lift tile", className)}>
      <div className="text-xs text-faint">{label}</div>
      <div className="score mt-1.5 break-words text-xl sm:text-3xl">{value}</div>
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
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {rank && <Tile label="Classement" value={rank.value} detail={rank.detail} />}
        {winnings && <Tile label="Gains totaux" value={winnings} detail="estimation Liquipedia" />}
        {palmares && <Tile label="Titres" value={<Num value={palmares.titles} />} detail={`dont ${palmares.majorTitles} en S-Tier`} />}
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
    <span className="rate-track" aria-hidden>
      <span className="rate-fill" style={{ transform: `scaleX(${rate})` }} />
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
      <td className="score w-16 whitespace-nowrap px-2 py-2 text-right text-lg">{tally.played ? <Num value={Math.round(tally.rate * 100)} suffix=" %" /> : ""}</td>
      <td className="hidden w-32 py-2 pr-4 sm:table-cell">{tally.played > 0 && <RateBar rate={tally.rate} />}</td>
    </tr>
  );
}

const pluralize = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

const eraDates = (era: Era, now: number) => {
  const day = (iso: string) => infoDate(iso, now);
  return era.to ? `${day(era.from)} → ${day(era.to)} · ${tenure(era.from, era.to, now)}` : `depuis le ${day(era.from)} · ${tenure(era.from, undefined, now)}`;
};

/**
 * Le bilan de chaque effectif du club : on y choisit celui que les statistiques
 * ci-dessous décrivent. Un lien par ligne : le choix tient dans l'adresse.
 */
export function EraTable({ eras, selected, total, palmares, base, now }: { eras: Era[]; selected?: Era; total: PastMatch[]; palmares?: Palmares; base: string; now: number }) {
  if (!eras.length) return null;
  const line = (href: string, active: boolean, label: React.ReactNode, sub: React.ReactNode, results: PastMatch[], titles?: number) => {
    const t = tally(results);
    return (
      <li key={href}>
        <Link
          href={`${href}#statistiques`}
          scroll={false}
          aria-current={active ? "true" : undefined}
          className={cn("row-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-l-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_8rem]", active ? "border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_13%,transparent)]" : "border-l-transparent")}
        >
          <span className="min-w-0">
            <span className="display block truncate text-lg">{label}</span>
            <span className="block text-xs text-faint">
              {sub}
              {titles ? ` · ${pluralize(titles, "titre")}` : ""}
            </span>
          </span>
          <span className="text-right">
            <span className="score block text-2xl">{t.played ? <Num value={Math.round(t.rate * 100)} suffix=" %" /> : "—"}</span>
            <span className="block whitespace-nowrap text-xs tabular-nums text-faint">{t.played ? `${t.wins} V · ${t.losses} D` : "pas encore de match"}</span>
          </span>
          <span className="hidden sm:block">{t.played > 0 && <RateBar rate={t.rate} />}</span>
        </Link>
      </li>
    );
  };
  return (
    <section>
      <SectionTitle aside={<span className="text-xs text-faint">choisis un effectif pour ses statistiques</span>}>Par effectif</SectionTitle>
      <ul className="stagger divide-y divide-line overflow-hidden panel">
        {eras.map((era) =>
          line(
            era.current ? base : `${base}?effectif=${era.from}`,
            selected?.from === era.from,
            <>
              {era.current && <span className="mr-2 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent)]">Actuel</span>}
              {era.players.join(" · ")}
            </>,
            eraDates(era, now),
            era.results,
            titlesIn(era, palmares),
          ),
        )}
        {line(`${base}?effectif=tout`, !selected, "Tout l'historique du club", pluralize(total.length, "match"), total)}
      </ul>
    </section>
  );
}

/** Un chiffre qui occupe toute la largeur : le bilan de l'effectif choisi, pour rompre le rythme des tableaux. */
export function EraMoment({ results, label }: { results: PastMatch[]; label: string }) {
  const t = tally(results);
  if (!t.played) return null;
  return (
    <section className="moment">
      <div className="moment-inner">
        <div className="moment-figure">
          <Num value={Math.round(t.rate * 100)} />
          <small>%</small>
        </div>
        <div className="min-w-0">
          <div className="display text-3xl sm:text-5xl">de victoires</div>
          <p className="mt-2 text-sm text-dim">
            {pluralize(t.wins, "victoire")}, {pluralize(t.losses, "défaite")} {label}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Bilans, courbe de forme, records et adversaires, sur l'effectif choisi. */
export function TeamStatistics({ results, scope, now, teamHref }: { results: PastMatch[]; scope?: string; now: number; teamHref: (t: TeamRef) => string | undefined }) {
  if (!results.length)
    return (
      <section id="statistiques" className="scroll-mt-24">
        <SectionTitle>Statistiques</SectionTitle>
        <p className="panel px-4 py-6 text-center text-sm text-faint">Cet effectif n&apos;a pas encore joué de match connu de Liquipedia.</p>
      </section>
    );
  const first = results[results.length - 1];
  const periods = byPeriod(results, now);
  const tiers = byTier(results);
  const records = recordsOf(results);
  const { victims, nemeses } = rivals(results);
  const size = 10;
  const curve = formCurve(results, size);
  const dates = (s?: { from: number; to: number }) => (s ? `${shortDate(s.from, now)} → ${shortDate(s.to, now)}` : undefined);
  return (
    <section id="statistiques" className="scroll-mt-24 space-y-3">
      <SectionTitle aside={<span className="text-right text-xs text-faint">{scope ? `${scope} · ` : ""}{pluralize(results.length, "match")} depuis {shortDate(first.timestamp, now)}</span>}>Statistiques</SectionTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden panel">
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
          <div className="overflow-hidden panel">
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

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {records.bestStreak && <Tile label="Meilleure série" value={<Num value={records.bestStreak.count} suffix={records.bestStreak.count > 1 ? " victoires" : " victoire"} />} detail={dates(records.bestStreak)} />}
        {records.worstStreak && <Tile label="Pire série" value={<Num value={records.worstStreak.count} suffix={records.worstStreak.count > 1 ? " défaites" : " défaite"} />} detail={dates(records.worstStreak)} />}
        {records.seriesPlayed > 0 && <Tile label="Balayages" value={<Num value={records.sweeps} />} detail={`${records.sweptBy} subis · sur ${pluralize(records.seriesPlayed, "série")}`} />}
        {records.deciders > 0 && <Tile label="Manches décisives" value={<Num value={Math.round((records.decidersWon / records.deciders) * 100)} suffix=" %" />} detail={`${records.decidersWon} gagnées sur ${records.deciders}`} />}
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
    <div className="overflow-hidden panel">
      <div className="border-b border-line px-4 py-2 text-xs text-faint">{title}, à partir de 3 matchs</div>
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((r) => {
            const href = teamHref(r.opponent);
            return (
              <li key={r.opponent.page ?? r.opponent.name} className="row-hover flex items-center gap-2 px-4 py-2 text-sm">
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
                <span className="score w-14 text-right text-lg">{percent(r.tally.rate)}</span>
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
    <div className="overflow-hidden panel">
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
              <td className="score w-16 whitespace-nowrap px-2 py-2 text-right text-lg">
                <Num value={Math.round(m.rate * 100)} suffix=" %" />
              </td>
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
        <Tile label="Manches gagnées" value={<Num value={Math.round(summary.rate * 100)} suffix=" %" />} detail={`${summary.wins} sur ${summary.played}`} className="col-span-2 lg:col-span-1" />
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
    <li key={i} className={cn("row-hover grid grid-cols-[3.5rem_4rem_minmax(0,1fr)_auto] items-center gap-2 border-l-2 px-4 py-2 text-sm", r.rank === 1 ? "border-l-[var(--accent)]" : "border-l-transparent")}>
      <span className="text-xs text-faint">{r.date ? infoDate(r.date, now) : "—"}</span>
      <span className={cn("score whitespace-nowrap text-lg", placeColor(r.rank))}>{placeFr(r.place)}</span>
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
  const trophies = palmares.rows.filter((r) => r.rank === 1).slice(0, 4);
  return (
    <section className="space-y-3">
      <SectionTitle aside={<span className="text-xs text-faint">{pluralize(palmares.events, "compétition")}</span>}>Palmarès</SectionTitle>
      <div className="vitrine p-5 sm:p-7">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-9">
          <div>
            <div className="vitrine-count">
              <Num value={palmares.titles} />
            </div>
            <div className="display mt-1 text-2xl text-[#f6c453]">{palmares.titles > 1 ? "Titres" : "Titre"}</div>
            <dl className="mt-3 grid grid-cols-3 gap-4 text-xs text-faint sm:gap-5">
              <div>
                <dd className="score text-2xl text-ink">
                  <Num value={palmares.majorTitles} />
                </dd>
                <dt>en S-Tier</dt>
              </div>
              <div>
                <dd className="score text-2xl text-ink">
                  <Num value={palmares.finals} />
                </dd>
                <dt>finales perdues</dt>
              </div>
              <div>
                <dd className="score text-2xl text-ink">
                  <Num value={palmares.podiums} />
                </dd>
                <dt>podiums</dt>
              </div>
            </dl>
          </div>
          {trophies.length > 0 && (
            <ul className="stagger grid gap-2 sm:grid-cols-2">
              {trophies.map((r, i) => (
                <li key={i} className="trophy">
                  <span className="display line-clamp-2 text-base leading-tight">{r.tournament.name}</span>
                  <span className="text-xs text-dim">{[r.date ? infoDate(r.date, now) : null, money(r.prize)].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="overflow-hidden panel">
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
      <ul className="divide-y divide-line overflow-hidden panel">
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
          <ul className="divide-y divide-line overflow-hidden panel">
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
          <ul className="space-y-2 panel p-4 text-sm text-dim">
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
  /** Depuis quand l'effectif en place joue ensemble. */
  since?: string;
  /** Ses résultats, du plus récent au plus ancien. */
  results?: { timestamp: number; result: PastMatch["result"] }[];
  /** Ses résultats ne remontent pas loin : au-delà, le bilan de l'effectif serait faux. */
  partial?: boolean;
  now: number;
}

/** Le bilan de l'effectif en place, si les résultats connus remontent jusqu'à son arrivée. */
function lineupRecord(side: DuelSide): { text: string; wins: number } | undefined {
  const { since, results } = side;
  if (!since || !results) return undefined;
  const oldest = results.at(-1)?.timestamp;
  if (side.partial && results.length >= 10 && oldest !== undefined && new Date(oldest * 1000).toISOString().slice(0, 10) > since) return undefined;
  const t = tally(results.filter((r) => new Date(r.timestamp * 1000).toISOString().slice(0, 10) >= since));
  // La fiche d'un adversaire a jusqu'à un jour de retard : « 0 V · 0 D » ferait croire qu'il n'a pas joué.
  if (side.partial && !t.played) return undefined;
  return { text: `${t.wins} V · ${t.losses} D`, wins: t.played ? t.rate : 0 };
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
  /** La part de mon équipe, quand les deux chiffres s'additionnent : la barre de force. */
  share?: number;
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
    { label: "Effectif en place depuis", left: us.since && infoDate(us.since, us.now), right: them.since && infoDate(them.since, them.now) },
    { label: "Bilan de cet effectif", left: lineupRecord(us)?.text, right: lineupRecord(them)?.text, us: lineupRecord(us)?.wins, them: lineupRecord(them)?.wins },
    { label: "Club créé en", left: year(us.info), right: year(them.info) },
  ];
  const shown: DuelLine[] = lines
    .filter((l) => l.left || l.right)
    .map((l) => (l.label !== "Classement" && l.us !== undefined && l.them !== undefined && l.us + l.them > 0 ? { ...l, share: l.us / (l.us + l.them) } : l));
  if (!lines.some((l) => l.left && l.right)) return null;
  const strong = (mine?: number, other?: number) => (mine !== undefined && other !== undefined && mine > other ? "font-semibold text-ink" : "text-dim");
  return (
    <section>
      <SectionTitle>Le duel</SectionTitle>
      <div className="overflow-hidden panel">
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
            <div key={l.label} className="px-4 py-2.5 text-sm tabular-nums">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-3">
                <dd className={strong(l.us, l.them)}>{l.left ?? "—"}</dd>
                <dt className="text-center text-xs text-faint">{l.label}</dt>
                <dd className={cn("text-right", strong(l.them, l.us))}>{l.right ?? "—"}</dd>
              </div>
              {l.share !== undefined && (
                <div className="mt-1.5 flex h-1 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  <span className="reveal-line rounded-full bg-[var(--accent)]" style={{ width: `${l.share * 100}%` }} />
                  <span className="flex-1 rounded-full bg-panel-2" />
                </div>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
