"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const THRESHOLD = 76;
const MAX = 120;

/** L'appli installée : plein écran, sans barre d'adresse ni bouton pour recharger. */
function installed(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Tirer pour rafraîchir, dans l'appli installée seulement : le navigateur le fait déjà dans un
 * onglet. Le logo descend avec le doigt, sa coupure s'ouvre à mesure, et tourne pendant la mise à
 * jour. Les données sont relues sans recharger la page.
 */
export function PullToRefresh({ mark }: { mark: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(false);
  const pill = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => setEnabled(installed()), []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.setAttribute("data-standalone", "");
    let start: { y: number; x: number } | null = null;
    let pull = 0;
    const el = pill.current;
    const show = (d: number) => {
      if (!el) return;
      const p = Math.min(1, d / THRESHOLD);
      el.style.transform = `translate(-50%, ${d - 56}px) rotate(${p * 200}deg)`;
      el.style.opacity = String(Math.min(1, d / 40));
      el.toggleAttribute("data-ready", d >= THRESHOLD);
      el.style.setProperty("--open", p.toFixed(3));
    };
    const onStart = (e: TouchEvent) => {
      if (busy.current || scrollY > 0 || e.touches.length !== 1) return;
      start = { y: e.touches[0].clientY, x: e.touches[0].clientX };
      pull = 0;
      if (el) el.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dy = e.touches[0].clientY - start.y;
      const dx = e.touches[0].clientX - start.x;
      if (dy <= 0 || Math.abs(dx) > dy) {
        if (pull === 0) start = null;
        return;
      }
      // La page ne doit ni rebondir ni défiler pendant qu'on tire.
      e.preventDefault();
      pull = Math.min(MAX, dy * 0.5);
      show(pull);
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      if (el) el.style.transition = "";
      if (pull >= THRESHOLD) {
        busy.current = true;
        el?.setAttribute("data-spin", "");
        show(THRESHOLD);
        startTransition(() => router.refresh());
      } else {
        show(0);
      }
      pull = 0;
    };
    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: false });
    addEventListener("touchend", onEnd);
    addEventListener("touchcancel", onEnd);
    return () => {
      removeEventListener("touchstart", onStart);
      removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd);
      removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, router]);

  // La mise à jour est arrivée : le logo remonte, après au moins un tour complet.
  useEffect(() => {
    if (pending || !busy.current) return;
    const el = pill.current;
    const t = setTimeout(() => {
      busy.current = false;
      if (!el) return;
      el.removeAttribute("data-spin");
      el.removeAttribute("data-ready");
      el.style.transform = "translate(-50%, -56px)";
      el.style.opacity = "0";
    }, 650);
    return () => clearTimeout(t);
  }, [pending]);

  if (!enabled) return null;
  return <div ref={pill} className="ptr" aria-hidden dangerouslySetInnerHTML={{ __html: mark }} />;
}
