"use client";

import { useEffect, useRef } from "react";

/**
 * Le petit tableau collé sous l'en-tête. Son parent, la grande scène, se replie à mesure qu'on
 * défile : `--p` va de 0 (scène entière) à 1 (scène sortie), écrit à chaque image plutôt qu'à
 * chaque événement, et le CSS en tire tout le reste.
 */
export function ArenaDock({ children }: { children: React.ReactNode }) {
  const dock = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = dock.current;
    const arena = el?.parentElement;
    if (!el || !arena) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const box = arena.getBoundingClientRect();
      const span = Math.max(1, box.height);
      const p = Math.min(1, Math.max(0, (header - box.top) / span));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      arena.style.setProperty("--p", p.toFixed(3));
      el.style.top = `${header}px`;
      el.toggleAttribute("data-on", p > 0.72);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue, { passive: true });
    return () => {
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <button ref={dock} type="button" className="dock" aria-label="Revenir en haut" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>
      <span className="dock-inner">{children}</span>
    </button>
  );
}
