"use client";

import { useEffect, useRef, useState } from "react";

const MIN = 0.45;
const MAX = 1.4;
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

/**
 * Le bracket se zoome : boutons − et +, pincement à deux doigts sur téléphone, pincement du pavé
 * tactile (ou Ctrl + molette) sur ordinateur. Dézoomé, on voit tout l'arbre d'un coup d'œil.
 */
export function BracketZoom({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const current = useRef(1);
  current.current = zoom;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let pinch: { d: number; z: number } | null = null;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d: distance(e.touches), z: current.current };
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      // Le pincement zoome le bracket, pas toute la page.
      e.preventDefault();
      setZoom(clamp(pinch.z * (distance(e.touches) / pinch.d)));
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * Math.exp(-e.deltaY / 300)));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div ref={root} className="bk-zoom" style={{ "--zoom": zoom } as React.CSSProperties}>
      <div className="bk-zoom-bar" data-noswipe="">
        <button type="button" onClick={() => setZoom((z) => clamp(z - 0.15))} disabled={zoom <= MIN} aria-label="Dézoomer le bracket">
          −
        </button>
        <button type="button" onClick={() => setZoom(1)} className="bk-zoom-level" aria-label="Taille normale">
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" onClick={() => setZoom((z) => clamp(z + 0.15))} disabled={zoom >= MAX} aria-label="Zoomer le bracket">
          +
        </button>
      </div>
      {children}
    </div>
  );
}
