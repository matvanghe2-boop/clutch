import { countryCode } from "@/config/countries";
import { infoDate, tenure } from "@/lib/format";
import type { RosterEntry, TeamRef } from "@/lib/types";
import { Logo } from "./ui";

/** Les remplaçants et l'encadrement passent après les titulaires. */
const BENCH = /coach|manager|analyst|sub|stand|rfa|inactive|loan/i;

/**
 * L'effectif en cartes à collectionner : le pseudo en grand, le pays, le rôle, l'ancienneté.
 * À la souris, la carte s'incline et son reflet suit le curseur (lib/motion/tilt.ts) ; au doigt,
 * le reflet balaie la carte tout seul. Pas de page joueur : la carte se suffit.
 */
export function RosterCards({ players, team, now }: { players: RosterEntry[]; team: TeamRef; now: number }) {
  const sorted = [...players].sort((a, b) => Number(BENCH.test(a.role ?? "")) - Number(BENCH.test(b.role ?? "")) || (a.joined ?? "").localeCompare(b.joined ?? ""));
  return (
    <ul className="cards-grid stagger">
      {sorted.map((p, i) => {
        const code = countryCode(p.country);
        const since = tenure(p.joined, undefined, now);
        return (
          <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
            <article className="player-card" data-bench={BENCH.test(p.role ?? "") ? "" : undefined}>
              <span className="pc-holo" aria-hidden />
              <span className="pc-mark" aria-hidden>
                <Logo team={team} size={120} />
              </span>
              <header className="pc-top">
                {code ? (
                  <span className="pc-flag" title={p.country}>
                    {code}
                  </span>
                ) : (
                  <span />
                )}
                {p.captain ? (
                  <span className="pc-captain" title="Capitaine">
                    C
                  </span>
                ) : p.role ? (
                  <span className="pc-role">{p.role}</span>
                ) : null}
              </header>
              <h3 className="pc-name display">{p.id}</h3>
              <footer className="pc-foot">
                {p.name && <span className="block truncate text-dim">{p.name}</span>}
                {p.joined && (
                  <span className="block text-faint" title={`Arrivée : ${infoDate(p.joined, now)}`}>
                    {since ? `Ici depuis ${since}` : `Arrivé ${infoDate(p.joined, now)}`}
                  </span>
                )}
              </footer>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
