"use client";

import { useRef, useState } from "react";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * « Mon parcours » : la vue suit l'équipe match après match dans le bracket, dans l'ordre où ils se
 * sont joués. Le reste s'efface le temps du trajet. Un second clic, ou un clic ailleurs, l'arrête.
 */
export function BracketCamera({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  const run = async () => {
    const el = root.current;
    if (!el) return;
    if (stop.current) {
      stop.current();
      return;
    }
    const cards = [...el.querySelectorAll<HTMLElement>(".bk-card[data-ours]")].sort((a, b) => Number(a.dataset.at ?? 0) - Number(b.dataset.at ?? 0));
    if (!cards.length) return;
    let cancelled = false;
    const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = quiet ? "auto" : "smooth";
    const end = () => {
      cancelled = true;
      stop.current = null;
      removeEventListener("pointerdown", outside, true);
      el.removeAttribute("data-cam");
      el.querySelectorAll("[data-cam-on]").forEach((c) => c.removeAttribute("data-cam-on"));
      setRunning(false);
    };
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-cam-button]")) end();
    };
    stop.current = end;
    addEventListener("pointerdown", outside, true);
    setRunning(true);
    el.setAttribute("data-cam", "");
    const scroller = el.querySelector<HTMLElement>(".bk-scroll");
    for (const card of cards) {
      if (cancelled) return;
      el.querySelectorAll("[data-cam-on]").forEach((c) => c.removeAttribute("data-cam-on"));
      card.setAttribute("data-cam-on", "");
      const box = card.getBoundingClientRect();
      if (scroller) {
        const area = scroller.getBoundingClientRect();
        scroller.scrollBy({ left: box.left - area.left - (area.width - box.width) / 2, behavior });
      }
      if (box.top < 120 || box.bottom > innerHeight - 40) scrollBy({ top: box.top - (innerHeight - box.height) / 2, behavior });
      await wait(1000);
    }
    if (!cancelled) {
      await wait(400);
      if (!cancelled) end();
    }
  };

  return (
    <div ref={root} className="space-y-2">
      <div className="flex justify-end">
        <button type="button" data-cam-button="" onClick={run} className="cam-button display">
          <span className="cam-dot" aria-hidden />
          {running ? "Arrêter" : "Mon parcours"}
        </button>
      </div>
      {children}
    </div>
  );
}
