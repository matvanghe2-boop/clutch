"use client";

import { useEffect, useRef } from "react";

/** La frise s'ouvre sur les titres les plus récents, à droite, dès qu'elle devient visible : un onglet fermé n'a pas de largeur. */
export function FriseScroller({ children }: { children: React.ReactNode }) {
  const self = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = self.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      el.scrollLeft = el.scrollWidth;
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={self} className="frise scrollbar-thin" data-noswipe="">
      {children}
    </div>
  );
}
