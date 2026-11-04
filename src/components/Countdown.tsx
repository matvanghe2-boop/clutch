"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Compte à rebours à la seconde ; `initialNow` évite un écart au premier rendu serveur. */
export function Countdown({ ts, initialNow }: { ts: number; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, Math.floor(ts - now));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = diff === 0 ? "C'est l'heure" : d > 0 ? `${d} j ${h} h ${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  return (
    <span suppressHydrationWarning className="tabular-nums">
      {label}
    </span>
  );
}
