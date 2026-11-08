import { photoCredit } from "@/lib/photos";
import type { PlayerPhoto } from "@/lib/types";

/**
 * La photo d'un joueur, à la manière du site : en deux tons (le bleu nuit de la page et la
 * couleur de l'équipe), une trame de points et une coupure en biais. Au survol, les vraies
 * couleurs remontent. Deux copies de la même image (une seule est téléchargée) : la bichromie
 * passe par un mode de fusion, qu'on ne peut pas faire glisser vers la photo d'origine.
 */
export function Portrait({ photo, className }: { photo: PlayerPhoto; className?: string }) {
  return (
    <span className={`portrait ${className ?? ""}`} title={photoCredit(photo)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- photo de Liquipedia Commons, sans proxy */}
      <img className="portrait-duo" src={photo.src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element -- la même, en couleurs, pour le survol */}
      <img className="portrait-real" src={photo.src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable={false} aria-hidden />
    </span>
  );
}

/** Le crédit, en petit, avec un lien vers la page de la photo. */
export function PhotoCredit({ photo, className }: { photo: PlayerPhoto; className?: string }) {
  const text = photoCredit(photo);
  return photo.file ? (
    <a href={photo.file} target="_blank" rel="noopener noreferrer" className={`photo-credit ${className ?? ""}`} title={`${text} · via Liquipedia`}>
      {text}
    </a>
  ) : (
    <span className={`photo-credit ${className ?? ""}`}>{text}</span>
  );
}
