"use client";

import { playIntro } from "@/lib/motion/intro";

/** Rejoue la grande scène du VS sur la feuille de match, en version complète. */
export function ReplayVs({ game }: { game: string }) {
  return (
    <button
      type="button"
      className="replay-vs"
      onClick={(e) => {
        const arena = document.querySelector<HTMLElement>("main .arena");
        if (!arena) return;
        scrollTo({ top: 0, behavior: "instant" });
        arena.removeAttribute("data-landed");
        const intro = playIntro({ source: e.currentTarget, colors: ["", ""], names: ["", ""], logos: ["", ""], game, short: false });
        if (!intro) {
          arena.setAttribute("data-landed", "");
          return;
        }
        requestAnimationFrame(() => intro.commit(arena, () => arena.setAttribute("data-landed", "")));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 12a8 8 0 1 0 2.4-5.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Rejouer le VS
    </button>
  );
}
