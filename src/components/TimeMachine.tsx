"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface TimePoint {
  /** Date du match, en secondes. */
  t: number;
  r: "win" | "loss" | "draw";
  /** Adversaire. */
  o?: string;
  /** Son logo. */
  lg?: string;
  /** Compétition. */
  tn?: string;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const LETTER = { win: "V", loss: "D", draw: "N" } as const;

/**
 * Remonter le temps : un curseur fait défiler les matchs de l'effectif choisi, et tout se recalcule
 * à la date choisie (bilan, part de victoires, série en cours, derniers résultats). « Lecture »
 * rejoue la saison d'un bout à l'autre.
 */
export function TimeMachine({ points }: { points: TimePoint[] }) {
  const last = points.length - 1;
  const [at, setAt] = useState(last);
  const [playing, setPlaying] = useState(false);
  const frame = useRef(0);

  useEffect(() => setAt(last), [last]);

  const view = useMemo(() => {
    const upTo = points.slice(0, at + 1);
    const wins = upTo.filter((p) => p.r === "win").length;
    const losses = upTo.filter((p) => p.r === "loss").length;
    let streak = 0;
    for (let i = at; i >= 0 && points[i].r === points[at].r; i--) streak++;
    return { wins, losses, rate: upTo.length ? Math.round((wins / upTo.length) * 100) : 0, streak, recent: upTo.slice(-5).reverse() };
  }, [points, at]);

  // La lecture : toute la saison en quelques secondes, plus vite quand il y a beaucoup de matchs.
  const play = () => {
    if (playing) {
      cancelAnimationFrame(frame.current);
      setPlaying(false);
      return;
    }
    if (quiet()) {
      setAt(last);
      return;
    }
    setPlaying(true);
    const from = at >= last ? 0 : at;
    const duration = Math.min(9000, 2500 + (last - from) * 35);
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setAt(Math.round(from + (last - from) * k));
      if (k < 1) frame.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    frame.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const point = points[at];
  if (!point) return null;
  const streakWord = point.r === "win" ? "victoire" : point.r === "loss" ? "défaite" : "nul";
  return (
    <div className="panel tm">
      <div className="tm-head">
        <div>
          <div className="text-xs text-faint">Au</div>
          <div className="display text-2xl sm:text-3xl">{dateFmt.format(new Date(point.t * 1000))}</div>
        </div>
        <button type="button" onClick={play} className="tm-play" aria-label={playing ? "Arrêter la lecture" : "Rejouer la saison"}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
            </svg>
          )}
          <span>{playing ? "Pause" : "Lecture"}</span>
        </button>
      </div>

      <div className="tm-figures">
        <div>
          <span className="score text-4xl tabular-nums sm:text-5xl">
            {view.rate}
            <small className="text-2xl"> %</small>
          </span>
          <span className="block text-xs text-faint">de victoires</span>
        </div>
        <div>
          <span className="score text-3xl tabular-nums sm:text-4xl">
            {view.wins}
            <span className="px-1 text-faint">–</span>
            {view.losses}
          </span>
          <span className="block text-xs text-faint">victoires – défaites</span>
        </div>
        <div>
          <span className={`score text-3xl sm:text-4xl ${point.r === "win" ? "text-win" : point.r === "loss" ? "text-loss" : ""}`}>
            {view.streak}
          </span>
          <span className="block text-xs text-faint">
            {streakWord}
            {view.streak > 1 && point.r !== "draw" ? "s" : ""} de suite
          </span>
        </div>
        <div className="tm-recent" aria-label="Les cinq derniers résultats à cette date">
          {view.recent.map((p, i) => (
            <i key={`${p.t}-${i}`} className={`tm-chip tm-${p.r}`}>
              {LETTER[p.r]}
            </i>
          ))}
        </div>
      </div>

      {/* Toute la saison d'un coup d'œil : un trait par match, et la tête de lecture. */}
      <div
        className="tm-track"
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const pick = (x: number) => setAt(Math.round(Math.min(1, Math.max(0, (x - box.left) / box.width)) * last));
          pick(e.clientX);
          e.currentTarget.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => pick(ev.clientX);
          const target = e.currentTarget;
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", () => target.removeEventListener("pointermove", move), { once: true });
        }}
        data-noswipe=""
        aria-hidden
      >
        {points.map((p, i) => (
          <i key={i} className={`tm-tick tm-${p.r}`} data-past={i <= at ? "" : undefined} style={{ left: `${(i / Math.max(1, last)) * 100}%` }} />
        ))}
        <span className="tm-head-line" style={{ left: `${(at / Math.max(1, last)) * 100}%` }} />
      </div>
      <input type="range" min={0} max={last} value={at} onChange={(e) => setAt(Number(e.target.value))} className="tm-range" aria-label="Choisir une date dans la saison" data-noswipe="" />

      <p className="tm-match">
        {point.lg && (
          // eslint-disable-next-line @next/next/no-img-element -- logo de Liquipedia, sans proxy
          <img src={point.lg} alt="" referrerPolicy="no-referrer" />
        )}
        <span className={point.r === "win" ? "text-win" : point.r === "loss" ? "text-loss" : "text-dim"}>{point.r === "win" ? "Victoire" : point.r === "loss" ? "Défaite" : "Nul"}</span>
        <span className="truncate text-dim">
          {point.o ? `contre ${point.o}` : ""}
          {point.tn ? ` · ${point.tn}` : ""}
        </span>
      </p>
    </div>
  );
}
