"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface Story {
  team: { name: string; logo?: string; a: string; b: string; game: string };
  period: string;
  record: { wins: number; losses: number; rate: number };
  titles: string[];
  streak?: { count: number; dates: string };
  victim?: { name: string; logo?: string; wins: number; losses: number };
  best?: { players: string; rate: number; wins: number; losses: number; dates: string };
  prize?: { name: string; amount: string };
  next?: { them: string; logo?: string; when: string };
}

const SLIDE_MS = 5500;

/** Un nombre qui part de zéro quand sa diapositive s'affiche. */
function Count({ value, active }: { value: number; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return setN(0);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(value);
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1100);
      setN(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, active]);
  return <>{n}</>;
}

function Logo({ src }: { src?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- logo de Liquipedia, sans proxy
  return src ? <img src={src} alt="" referrerPolicy="no-referrer" className="story-logo" /> : null;
}

/**
 * La saison en récit : plein écran, comme des stories. Les diapositives avancent seules ; toucher
 * à droite avance, à gauche recule, un appui long met en pause, Échap ou la croix ferme.
 */
export function SeasonStory({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const slides: { key: string; body: (active: boolean) => React.ReactNode }[] = [
    {
      key: "intro",
      body: () => (
        <>
          <Logo src={story.team.logo} />
          <p className="story-kicker">{story.period}</p>
          <h2 className="story-big display">{story.team.name}</h2>
          <p className="story-sub">{story.team.game} · la saison en récit</p>
        </>
      ),
    },
    {
      key: "bilan",
      body: (active) => (
        <>
          <p className="story-kicker">Le bilan</p>
          <p className="story-huge display">
            <Count value={story.record.rate} active={active} />
            <small>%</small>
          </p>
          <p className="story-sub">
            de victoires : {story.record.wins} gagnés, {story.record.losses} perdus
          </p>
        </>
      ),
    },
    ...(story.titles.length
      ? [
          {
            key: "titres",
            body: (active: boolean) => (
              <>
                <p className="story-kicker">Les titres</p>
                <p className="story-huge display story-gold">
                  <Count value={story.titles.length} active={active} />
                </p>
                <ul className="story-list">
                  {story.titles.slice(0, 5).map((t, i) => (
                    <li key={i} style={{ "--i": i } as React.CSSProperties}>
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
        ]
      : []),
    ...(story.streak && story.streak.count > 2
      ? [
          {
            key: "serie",
            body: (active: boolean) => (
              <>
                <p className="story-kicker">La plus longue série</p>
                <p className="story-huge display">
                  <Count value={story.streak!.count} active={active} />
                </p>
                <p className="story-sub">victoires de suite · {story.streak!.dates}</p>
              </>
            ),
          },
        ]
      : []),
    ...(story.victim
      ? [
          {
            key: "victime",
            body: () => (
              <>
                <p className="story-kicker">La victime préférée</p>
                <Logo src={story.victim!.logo} />
                <h2 className="story-big display">{story.victim!.name}</h2>
                <p className="story-sub">
                  {story.victim!.wins} victoires, {story.victim!.losses} défaite{story.victim!.losses > 1 ? "s" : ""}
                </p>
              </>
            ),
          },
        ]
      : []),
    ...(story.best
      ? [
          {
            key: "effectif",
            body: (active: boolean) => (
              <>
                <p className="story-kicker">Le meilleur effectif</p>
                <h2 className="story-mid display">{story.best!.players}</h2>
                <p className="story-huge display">
                  <Count value={story.best!.rate} active={active} />
                  <small>%</small>
                </p>
                <p className="story-sub">
                  {story.best!.wins} V – {story.best!.losses} D · {story.best!.dates}
                </p>
              </>
            ),
          },
        ]
      : []),
    ...(story.prize
      ? [
          {
            key: "gain",
            body: () => (
              <>
                <p className="story-kicker">Le plus gros chèque</p>
                <p className="story-big display story-gold">{story.prize!.amount}</p>
                <p className="story-sub">{story.prize!.name}</p>
              </>
            ),
          },
        ]
      : []),
    {
      key: "suite",
      body: () => (
        <>
          <p className="story-kicker">À suivre</p>
          {story.next ? (
            <>
              <Logo src={story.next.logo} />
              <h2 className="story-big display">{story.next.them}</h2>
              <p className="story-sub">{story.next.when}</p>
            </>
          ) : (
            <h2 className="story-big display">La suite bientôt</h2>
          )}
        </>
      ),
    },
  ];

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);
  const go = useCallback(
    (step: number) =>
      setIndex((i) => {
        const next = i + step;
        if (next >= slides.length) {
          close();
          return i;
        }
        return Math.max(0, next);
      }),
    [slides.length, close],
  );

  // Avance automatique, sauf pendant un appui.
  useEffect(() => {
    if (!open || paused) return;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, paused, index, go]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", key);
    document.documentElement.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", key);
      document.documentElement.style.overflow = "";
    };
  }, [open, go, close]);

  const press = useRef(0);
  return (
    <>
      <button
        ref={opener}
        type="button"
        className="story-open"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
        </svg>
        La saison en récit
      </button>
      {open &&
        createPortal(
          <div className="story" role="dialog" aria-modal="true" aria-label={`La saison de ${story.team.name}`} style={{ "--a": story.team.a, "--b": story.team.b } as React.CSSProperties}>
            <div className="story-bars" aria-hidden>
              {slides.map((s, i) => (
                <span key={s.key}>
                  <i data-state={i < index ? "done" : i === index ? (paused ? "paused" : "run") : undefined} style={{ animationDuration: `${SLIDE_MS}ms` }} />
                </span>
              ))}
            </div>
            <button type="button" className="story-close" onClick={close} aria-label="Fermer">
              ✕
            </button>
            <div
              className="story-stage"
              onPointerDown={() => {
                press.current = performance.now();
                setPaused(true);
              }}
              onPointerUp={(e) => {
                setPaused(false);
                // Un appui long ne fait que mettre en pause.
                if (performance.now() - press.current > 350) return;
                const box = e.currentTarget.getBoundingClientRect();
                go(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
              }}
              onPointerLeave={() => setPaused(false)}
            >
              {slides.map((s, i) => (
                <section key={s.key} className="story-slide" data-active={i === index ? "" : undefined} aria-hidden={i !== index}>
                  {s.body(i === index)}
                </section>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
