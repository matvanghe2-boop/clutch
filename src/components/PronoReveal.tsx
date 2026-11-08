"use client";

import { useEffect, useRef, useState } from "react";
import { REVEAL_COOKIE } from "@/lib/visit";

function remember(id: string) {
  let list: string[] = [];
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${REVEAL_COOKIE}=`))?.slice(REVEAL_COOKIE.length + 1);
    if (raw) list = JSON.parse(decodeURIComponent(raw));
  } catch {}
  // Les derniers seulement : un vieux verdict n'est de toute façon plus caché (voir la page).
  const next = [...list.filter((x) => x !== id), id].slice(-30);
  document.cookie = `${REVEAL_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${30 * 86400}; samesite=lax`;
}

/**
 * Le verdict d'un pronostic, d'abord face cachée : la carte se retourne quand elle arrive à
 * l'écran (ou au toucher), une seule fois par pronostic. Score exact : la carte s'embrase.
 */
export function PronoReveal({ id, covered, verdict, children }: { id: string; covered: boolean; verdict: { points: number; exact: boolean }; children: React.ReactNode }) {
  const [open, setOpen] = useState(!covered);
  const self = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (open) return;
    const el = self.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          setOpen(true);
          remember(id);
        }, 650);
      },
      { threshold: 0.9 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [open, id]);

  if (!covered) return <>{children}</>;
  return (
    <span
      ref={self}
      className="reveal"
      data-open={open ? "" : undefined}
      data-tone={verdict.exact ? "exact" : verdict.points ? "winner" : "miss"}
      onClick={() => {
        if (open) return;
        setOpen(true);
        remember(id);
      }}
    >
      <span className="reveal-front" aria-hidden={open}>
        ? Verdict
      </span>
      {/* Monté au retournement : l'éclat d'un score exact (ExactMoment) part avec la carte, pas avant. */}
      <span className="reveal-back" aria-hidden={!open}>
        {open ? children : null}
      </span>
    </span>
  );
}
