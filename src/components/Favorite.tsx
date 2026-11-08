"use client";

import { useEffect, useState } from "react";

const KEY = "clutch:fav";

type Fav = { id: string; a: string; b: string };

function read(): Fav | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Fav | null;
  } catch {
    return null;
  }
}

/** Pose les couleurs de l'équipe préférée sur tout le site ; layout.tsx fait de même avant le premier affichage. */
function apply(fav: Fav | null) {
  const root = document.documentElement;
  if (fav) {
    root.style.setProperty("--fav-a", fav.a);
    root.style.setProperty("--fav-b", fav.b);
    root.setAttribute("data-fav", fav.id);
  } else {
    root.style.removeProperty("--fav-a");
    root.style.removeProperty("--fav-b");
    root.removeAttribute("data-fav");
  }
  dispatchEvent(new Event("clutch:fav"));
}

/**
 * L'étoile d'une équipe : choisie comme préférée, elle colore tout le site (en-tête, logo, fond).
 * Un choix de ce navigateur seulement, gardé dans son stockage local.
 */
export function FavoriteStar({ id, a, b, name }: { id: string; a: string; b: string; name: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(read()?.id === id), [id]);
  return (
    <button
      type="button"
      className="fav-star"
      data-on={on ? "" : undefined}
      aria-pressed={on}
      title={on ? `${name} n'est plus ton équipe préférée` : `Faire de ${name} ton équipe préférée : ses couleurs sur tout le site`}
      onClick={() => {
        const next = on ? null : { id, a, b };
        try {
          if (next) localStorage.setItem(KEY, JSON.stringify(next));
          else localStorage.removeItem(KEY);
        } catch {
          // Sans stockage, le choix ne vaut que pour cette page.
        }
        apply(next);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" strokeLinejoin="round" />
      </svg>
      <span>{on ? "Équipe préférée" : "Préférée"}</span>
    </button>
  );
}
