"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { countdownBeat, kickOff } from "@/lib/motion/moments";
import { stageOf } from "@/lib/motion/stage";

const pad = (n: number) => String(n).padStart(2, "0");

/** L'heure, à la seconde pile : les chiffres changent tous ensemble, et au bon moment. */
function useNow(initialNow: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const ms = Date.now();
      setNow(ms / 1000);
      timer = window.setTimeout(tick, 1000 - (ms % 1000) + 8);
    };
    tick();
    return () => clearTimeout(timer);
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

/**
 * Une case à palettes, comme sur un tableau d'aéroport : la moitié haute de l'ancien chiffre bascule,
 * puis la moitié basse du nouveau se rabat. La clé change avec la valeur : les animations se rejouent.
 */
function Cell({ value, label }: { value: string; label: string }) {
  const before = useRef(value);
  const old = before.current;
  useEffect(() => {
    before.current = value;
  }, [value]);
  return (
    <span className="cd-cell">
      <span className="flap" suppressHydrationWarning>
        <b className="flap-size" suppressHydrationWarning>
          {value}
        </b>
        <span key={value} className="flap-set" suppressHydrationWarning>
          <i className="flap-half flap-top">
            <b suppressHydrationWarning>{value}</b>
          </i>
          <i className="flap-half flap-bottom">
            <b suppressHydrationWarning>{old}</b>
          </i>
          {old !== value && (
            <>
              <i className="flap-half flap-fall-top">
                <b>{old}</b>
              </i>
              <i className="flap-half flap-fall-bottom">
                <b>{value}</b>
              </i>
            </>
          )}
        </span>
      </span>
      <span className="cd-label">{label}</span>
    </span>
  );
}

/**
 * Le grand compte à rebours des scènes de match. Les cases s'allument dans la dernière heure ;
 * la dernière minute remplace l'heure du match par un chiffre géant ; à zéro, la scène s'embrase
 * et la page se recharge pour passer le match en direct.
 */
export function CountdownCells({ ts, initialNow }: { ts: number; initialNow: number }) {
  const now = useNow(initialNow);
  const router = useRouter();
  const self = useRef<HTMLSpanElement>(null);
  const diff = Math.max(0, Math.ceil(ts - now));
  const stage = stageOf(diff);

  useEffect(() => {
    const el = self.current;
    if (el && stage === "final") countdownBeat(el, diff);
  }, [diff, stage]);

  // Seulement si on a vécu le passage à zéro : une page ouverte en retard n'a rien à fêter.
  const armed = useRef(stage !== "go");
  useEffect(() => {
    if (stage !== "go" || !armed.current) return;
    armed.current = false;
    if (self.current) kickOff(self.current);
    const id = setTimeout(() => router.refresh(), 2200);
    return () => clearTimeout(id);
  }, [stage, router]);

  if (stage === "go") {
    return (
      <span ref={self} data-stage="go" className="cd-go display">
        C&apos;est parti
      </span>
    );
  }
  if (stage === "final") {
    return (
      <span ref={self} data-stage="final" className="cd-final" role="timer" aria-label={`Dans ${diff} secondes`}>
        <span key={diff} className="cd-slam" data-last={diff <= 10 ? "" : undefined} suppressHydrationWarning>
          {diff}
        </span>
        <span className="cd-label">secondes</span>
      </span>
    );
  }
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span ref={self} data-stage={stage} className="inline-flex gap-1.5" role="timer" aria-label={`Dans ${d ? `${d} jours ` : ""}${h} heures ${m} minutes`}>
      {d > 0 && <Cell value={String(d)} label="jours" />}
      <Cell value={pad(h)} label="heures" />
      <Cell value={pad(m)} label="min" />
      {d === 0 && <Cell value={pad(s)} label="sec" />}
    </span>
  );
}
