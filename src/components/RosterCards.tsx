import { countryCode } from "@/config/countries";
import { infoDate, tenure } from "@/lib/format";
import type { PlayerPhoto, RosterEntry, TeamRef } from "@/lib/types";
import { PhotoCredit, Portrait } from "./Portrait";
import { Logo } from "./ui";

/** Les remplaçants et l'encadrement passent après les titulaires. */
export const BENCH = /coach|manager|analyst|sub|stand|rfa|inactive|loan/i;

/**
 * L'effectif en cartes à collectionner : le pseudo en grand, le pays, le rôle, l'ancienneté.
 * Sur le navigateur déverrouillé, la photo du joueur occupe la carte (voir src/lib/photos.ts).
 * À la souris, la carte s'incline et son reflet suit le curseur (lib/motion/tilt.ts) ; au doigt,
 * le reflet balaie la carte tout seul. Pas de page joueur : la carte se suffit.
 */
export function RosterCards({ players, team, now, photos = {} }: { players: RosterEntry[]; team: TeamRef; now: number; photos?: Record<string, PlayerPhoto> }) {
  const sorted = [...players].sort((a, b) => Number(BENCH.test(a.role ?? "")) - Number(BENCH.test(b.role ?? "")) || (a.joined ?? "").localeCompare(b.joined ?? ""));
  return (
    <ul className="cards-grid stagger">
      {sorted.map((p, i) => {
        const code = countryCode(p.country);
        const since = tenure(p.joined, undefined, now);
        const photo = photos[p.id];
        return (
          <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
            <article className="player-card" data-bench={BENCH.test(p.role ?? "") ? "" : undefined} data-photo={photo ? "" : undefined}>
              {photo ? (
                <Portrait photo={photo} className="pc-photo" />
              ) : (
                <span className="pc-mark" aria-hidden>
                  <Logo team={team} size={120} />
                </span>
              )}
              <span className="pc-holo" aria-hidden />
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
              {/* La taille suit la longueur du pseudo : « JoeDeceives » tient sur une ligne comme « 04 ». */}
              <h3 className="pc-name display" style={{ "--len": Math.max(4, p.id.length) } as React.CSSProperties}>
                {p.id}
              </h3>
              <footer className="pc-foot">
                {p.name && <span className="block truncate text-dim">{p.name}</span>}
                {p.joined && (
                  <span className="block text-faint" title={`Arrivée : ${infoDate(p.joined, now)}`}>
                    {since ? `Ici depuis ${since}` : `Arrivé ${infoDate(p.joined, now)}`}
                  </span>
                )}
                {photo && <PhotoCredit photo={photo} className="mt-1 block truncate" />}
              </footer>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * La ligne de l'équipe en portraits, dans l'en-tête de sa page : les titulaires qui ont une
 * photo, en éventail. Rien sans photo (navigateur verrouillé, ou Liquipedia n'en a pas).
 */
export function Lineup({ players, photos }: { players: RosterEntry[]; photos: Record<string, PlayerPhoto> }) {
  const starters = players.filter((p) => photos[p.id] && !BENCH.test(p.role ?? "")).slice(0, 6);
  if (!starters.length) return null;
  return (
    <ul className="lineup" aria-label="La ligne de l'équipe">
      {starters.map((p, i) => (
        <li key={p.id} style={{ "--i": i, "--n": starters.length } as React.CSSProperties}>
          <Portrait photo={photos[p.id]} className="lineup-face" />
          <span className="lineup-name display">{p.id}</span>
        </li>
      ))}
    </ul>
  );
}

/** Les visages d'une ligne, en rang serré : sous le nom de l'équipe, sur l'affiche du match. */
export function FaceRow({ players, photos, label }: { players: RosterEntry[]; photos: Record<string, PlayerPhoto>; label: string }) {
  const faces = players.filter((p) => photos[p.id] && !BENCH.test(p.role ?? "")).slice(0, 5);
  if (!faces.length) return null;
  return (
    <ul className="face-row" aria-label={label}>
      {faces.map((p, i) => (
        <li key={p.id} style={{ "--i": i } as React.CSSProperties} title={p.id}>
          <Portrait photo={photos[p.id]} className="face-row-face" />
        </li>
      ))}
    </ul>
  );
}
