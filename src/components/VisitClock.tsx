"use client";

import { useEffect } from "react";
import { VISIT_COOKIE } from "@/lib/visit";

const mark = () => {
  document.cookie = `${VISIT_COOKIE}=${Math.round(Date.now() / 1000)}; path=/; max-age=${365 * 86400}; samesite=lax`;
};

/**
 * Note l'heure à laquelle on quitte le site (onglet masqué, appli en arrière-plan, page fermée) :
 * à la visite suivante, l'accueil résume ce qui s'est passé depuis. Rien ne part ailleurs.
 */
export function VisitClock() {
  useEffect(() => {
    // Une toute première visite : on a au moins un point de départ.
    if (!document.cookie.includes(`${VISIT_COOKIE}=`)) mark();
    const hide = () => {
      if (document.visibilityState === "hidden") mark();
    };
    document.addEventListener("visibilitychange", hide);
    addEventListener("pagehide", mark);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      removeEventListener("pagehide", mark);
    };
  }, []);
  return null;
}

/** « Vu » : la carte s'en va, et ne reviendra qu'après une nouvelle absence. */
export function VisitClose() {
  return (
    <button
      type="button"
      className="since-close"
      aria-label="Masquer ce résumé"
      onClick={(e) => {
        mark();
        const card = e.currentTarget.closest<HTMLElement>(".since");
        if (!card) return;
        const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (quiet) {
          card.remove();
          return;
        }
        const h = card.offsetHeight;
        card
          .animate(
            [
              { opacity: 1, transform: "none", height: `${h}px` },
              { opacity: 0, transform: "translateY(-8px) scale(0.98)", height: `${h}px`, offset: 0.55 },
              { opacity: 0, height: "0px", marginBottom: "-2.5rem" },
            ],
            { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
          )
          .finished.then(() => card.remove());
      }}
    >
      Vu
    </button>
  );
}
