"use client";

import { useEffect, useRef } from "react";

/**
 * La grande scène se replie à mesure qu'on défile : `--p` va de 0 (scène entière) à 1 (scène
 * sortie), écrit à chaque image plutôt qu'à chaque événement, et le CSS en tire tout le reste.
 */
function useCollapse(self: React.RefObject<HTMLElement | null>, onChange?: (p: number, header: number) => void) {
  useEffect(() => {
    const arena = self.current?.parentElement;
    if (!arena || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const box = arena.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (header - box.top) / Math.max(1, box.height)));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      arena.style.setProperty("--p", p.toFixed(3));
      onChange?.(p, header);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule installation par scène
  }, []);
}

/** La scène se replie, sans tableau collé : sur une page à onglets, la barre d'onglets en tient lieu. */
export function ArenaCollapse() {
  const self = useRef<HTMLSpanElement>(null);
  useCollapse(self);
  return <span ref={self} hidden />;
}

/** Le petit tableau collé sous l'en-tête, qui prend le relais quand la scène est sortie. */
export function ArenaDock({ children }: { children: React.ReactNode }) {
  const dock = useRef<HTMLButtonElement>(null);
  useCollapse(dock, (p, header) => {
    const el = dock.current;
    if (!el) return;
    el.style.top = `${header}px`;
    el.toggleAttribute("data-on", p > 0.72);
  });
  return (
    <button ref={dock} type="button" className="dock" aria-label="Revenir en haut" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>
      <span className="dock-inner">{children}</span>
    </button>
  );
}
