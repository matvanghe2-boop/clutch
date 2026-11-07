"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

function useNow(initialNow: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Compte à rebours à la seconde ; `initialNow` évite un écart au premier rendu serveur. */
export function Countdown({ ts, initialNow }: { ts: number; initialNow: number }) {
  const now = useNow(initialNow);
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

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <span className="cd-cell">
      {/* La clé change avec la valeur : le chiffre est remonté, donc son entrée se rejoue. */}
      <span className="cd-value" suppressHydrationWarning>
        <span key={value} className="tick" suppressHydrationWarning>
          {value}
        </span>
      </span>
      <span className="cd-label">{label}</span>
    </span>
  );
}

/** Le grand compte à rebours des scènes de match, en cases. */
export function CountdownCells({ ts, initialNow }: { ts: number; initialNow: number }) {
  const now = useNow(initialNow);
  const diff = Math.max(0, Math.floor(ts - now));
  if (diff === 0) return <span className="display text-xl text-[var(--accent)]">C&apos;est l&apos;heure</span>;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span className="inline-flex gap-1.5" role="timer" aria-label={`Dans ${d ? `${d} jours ` : ""}${h} heures ${m} minutes`}>
      {d > 0 && <Cell value={String(d)} label="jours" />}
      <Cell value={pad(h)} label="heures" />
      <Cell value={pad(m)} label="min" />
      {d === 0 && <Cell value={pad(s)} label="sec" />}
    </span>
  );
}
