"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

interface Point {
  timestamp: number;
  /** De 0 à 1. */
  rate: number;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const tickFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "Europe/Paris" });
const percent = (r: number) => `${Math.round(r * 100)} %`;

/** Pour passer d'une courbe à une autre : la hauteur à intervalles réguliers, quel que soit le nombre de matchs. */
const SAMPLES = 140;

function sampled(points: Point[], first: number, span: number): number[] {
  const out: number[] = [];
  let i = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const t = first + (span * s) / (SAMPLES - 1);
    while (i < points.length - 1 && points[i + 1].timestamp <= t) i++;
    out.push((1 - points[i].rate) * 100);
  }
  return out;
}

const lineOf = (ys: number[]) => ys.map((y, i) => `${i ? "L" : "M"}${((i / (SAMPLES - 1)) * 100).toFixed(2)} ${y.toFixed(2)}`).join(" ");
const areaOf = (line: string) => `${line} L100 100 L0 100 Z`;

/**
 * Taux de victoire glissant dans le temps. Une seule courbe, nommée par le titre
 * de la section : pas de légende. Le repère vertical suit le pointeur et se cale
 * sur le match le plus proche ; au clavier, les flèches le déplacent. Quand on change
 * d'effectif, la courbe se transforme en la nouvelle au lieu d'être remplacée.
 *
 * Le tracé s'étire à la largeur (viewBox sans proportions) : ses traits gardent
 * leur épaisseur, et les textes sont en HTML pour rester lisibles sur téléphone.
 */
export function FormCurve({ points, window: size }: { points: Point[]; window: number }) {
  const [active, setActive] = useState<number | null>(null);
  const [first, last] = [points[0].timestamp, points[points.length - 1].timestamp];
  const span = Math.max(1, last - first);
  const xOf = (t: number) => ((t - first) / span) * 100;
  const yOf = (r: number) => (1 - r) * 100;

  const path = useMemo(() => points.map((p, i) => `${i ? "L" : "M"}${xOf(p.timestamp).toFixed(2)} ${yOf(p.rate).toFixed(2)}`).join(" "), [points]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = useMemo(() => `${path} L100 100 L0 100 Z`, [path]);
  const fill = useId();

  const line = useRef<SVGPathElement>(null);
  const under = useRef<SVGPathElement>(null);
  const before = useRef<number[] | null>(null);
  useLayoutEffect(() => {
    const next = sampled(points, first, span);
    const from = before.current;
    before.current = next;
    if (!from || !line.current || !under.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      const e = 1 - (1 - k) ** 4;
      if (k < 1) {
        const d = lineOf(from.map((y, i) => y + (next[i] - y) * e));
        line.current?.setAttribute("d", d);
        under.current?.setAttribute("d", areaOf(d));
        frame = requestAnimationFrame(step);
      } else {
        line.current?.setAttribute("d", path);
        under.current?.setAttribute("d", area);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repères de date répartis régulièrement.
  const ticks = useMemo(() => Array.from({ length: 5 }, (_, i) => first + (span * i) / 4), [first, span]);

  const nearest = (ratio: number) => {
    const t = first + ratio * span;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.timestamp - t) < Math.abs(points[best].timestamp - t)) best = i;
    });
    return best;
  };

  const shown = active !== null ? points[active] : null;
  const current = points[points.length - 1];

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-faint">Part de victoires sur les {size} matchs précédents, à chaque match</p>
        <p className="text-xs text-dim">
          Aujourd&apos;hui <b className="font-display text-base text-ink">{percent(current.rate)}</b>
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative h-44 w-9 shrink-0 text-right text-[11px] tabular-nums text-faint" aria-hidden>
          <span className="absolute right-0 top-0 -translate-y-1/2">100 %</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">50 %</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0 %</span>
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`Courbe du taux de victoire, de ${dateFmt.format(new Date(first * 1000))} à ${dateFmt.format(new Date(last * 1000))}. Actuellement ${percent(current.rate)}.`}
            tabIndex={0}
            className="relative h-44 cursor-crosshair touch-pan-y rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setActive(nearest(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))));
            }}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const from = active ?? points.length - 1;
              setActive(Math.min(points.length - 1, Math.max(0, from + (e.key === "ArrowRight" ? 1 : -1))));
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
              {[0, 50, 100].map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="curve-svg absolute inset-0 size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path ref={under} d={area} fill={`url(#${fill})`} />
              <path ref={line} d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 60%, transparent))" }} />
            </svg>

            {/* Le point d'aujourd'hui, au bout de la courbe. */}
            <span className="curve-head" style={{ top: `${yOf(current.rate)}%` }} aria-hidden />

            {shown && (
              <>
                <span className="pointer-events-none absolute inset-y-0 w-px bg-faint" style={{ left: `${xOf(shown.timestamp)}%` }} />
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-[var(--accent)]"
                  style={{ left: `${xOf(shown.timestamp)}%`, top: `${yOf(shown.rate)}%` }}
                />
                <span
                  className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-md border border-line bg-panel-2 px-2 py-1 text-xs shadow-lg"
                  style={
                    xOf(shown.timestamp) > 60
                      ? { right: `calc(${100 - xOf(shown.timestamp)}% + 8px)` }
                      : { left: `calc(${xOf(shown.timestamp)}% + 8px)` }
                  }
                >
                  <b className="font-display text-sm text-ink">{percent(shown.rate)}</b>
                  <span className="ml-1.5 text-faint">{dateFmt.format(new Date(shown.timestamp * 1000))}</span>
                </span>
              </>
            )}
          </div>

          <div className="relative mt-1.5 h-4 text-[11px] text-faint" aria-hidden>
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute whitespace-nowrap"
                style={i === 0 ? { left: 0 } : i === ticks.length - 1 ? { right: 0 } : { left: `${xOf(t)}%`, transform: "translateX(-50%)" }}
              >
                {tickFmt.format(new Date(t * 1000))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
