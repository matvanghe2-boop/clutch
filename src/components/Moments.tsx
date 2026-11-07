"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { goldBurst, scoreImpact, seriesStep, victory } from "@/lib/motion/moments";

const STEP_MS = 430;
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function once(key: string): boolean {
  try {
    return Boolean(sessionStorage.getItem(key));
  } catch {
    return true;
  }
}
function mark(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Sans stockage, le moment se rejouera : rien de grave.
  }
}

/** Les manches à gagner d'une série, en jetons qui s'allument un à un. */
function SeriesPips({ bestOf, us, them }: { bestOf: number; us: number; them: number }) {
  const need = Math.floor(bestOf / 2) + 1;
  const row = (won: number, side: "a" | "b") => (
    <span className={`pips pips-${side}`}>
      {Array.from({ length: need }, (_, i) => (
        <i key={i} data-on={i < won ? "" : undefined} className="pip" />
      ))}
    </span>
  );
  return (
    <span className="series" aria-label={`${us} à ${them}, en ${need} manches gagnantes`}>
      {row(us, "a")}
      {row(them, "b")}
    </span>
  );
}

const asNumber = (v: number | string) => (typeof v === "number" ? v : Number(v));

/**
 * Le score d'un match. Pendant le direct, la page se recharge seule : ce composant reste en place, et
 * un chiffre qui change joue le moment au lieu d'être remplacé en silence. À la première ouverture
 * d'un match fini, `story` raconte la série : les manches arrivent une à une, de 0–0 au score final.
 */
export function LiveScore({
  us,
  them,
  dimUs,
  dimThem,
  bestOf,
  story,
  storyKey,
  className = "text-5xl sm:text-6xl lg:text-8xl",
}: {
  us: number | string;
  them: number | string;
  dimUs?: boolean;
  dimThem?: boolean;
  bestOf?: number;
  /** Le vainqueur de chaque manche, dans l'ordre : « a » pour nous, « b » pour l'adversaire. */
  story?: ("a" | "b")[];
  storyKey?: string;
  className?: string;
}) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState({ us, them });
  const told = useRef(false);
  const previous = useRef({ us, them });

  // Une mise à jour du direct.
  useEffect(() => {
    if (told.current) return;
    if (previous.current.us !== us && a.current) scoreImpact(a.current, "a");
    if (previous.current.them !== them && b.current) scoreImpact(b.current, "b");
    previous.current = { us, them };
    setShown({ us, them });
  }, [us, them]);

  // Le récit de la série : avant la première image, pour qu'on ne voie pas le score final d'abord.
  useLayoutEffect(() => {
    if (!story?.length || !storyKey || quiet() || once(storyKey)) return;
    told.current = true;
    setShown({ us: 0, them: 0 });
    let cancelled = false;
    let timer = 0;
    const arena = a.current?.closest<HTMLElement>(".arena");
    const play = (i: number, score: { us: number; them: number }) => {
      if (cancelled) return;
      if (i >= story.length) {
        mark(storyKey);
        setShown({ us, them });
        previous.current = { us, them };
        told.current = false;
        return;
      }
      const side = story[i];
      const next = side === "a" ? { us: score.us + 1, them: score.them } : { us: score.us, them: score.them + 1 };
      setShown(next);
      const el = side === "a" ? a.current : b.current;
      if (el) {
        if (i === story.length - 1) scoreImpact(el, side);
        else seriesStep(el);
      }
      timer = window.setTimeout(() => play(i + 1, next), STEP_MS);
    };
    // On attend que la scène soit posée : l'intro, s'il y en a une, passe d'abord.
    const begin = () => {
      if (cancelled) return;
      if (arena?.hasAttribute("data-arrived") && !arena.hasAttribute("data-landed")) {
        timer = window.setTimeout(begin, 80);
        return;
      }
      timer = window.setTimeout(() => play(0, { us: 0, them: 0 }), 500);
    };
    begin();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      told.current = false;
      setShown({ us, them });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le récit ne se joue qu'à l'ouverture de la page
  }, []);

  const [nUs, nThem] = [asNumber(shown.us), asNumber(shown.them)];
  const need = bestOf && bestOf > 1 ? Math.floor(bestOf / 2) + 1 : 0;
  const pips = need > 0 && Number.isInteger(nUs) && Number.isInteger(nThem) && nUs <= need && nThem <= need;
  return (
    <>
      <div className={`score ${className}`} data-final={`${us}–${them}`}>
        <span ref={a} className={`inline-block ${dimUs ? "text-dim" : ""}`}>
          {shown.us}
        </span>
        <span className="px-2 text-faint">–</span>
        <span ref={b} className={`inline-block ${dimThem ? "text-dim" : ""}`}>
          {shown.them}
        </span>
      </div>
      {pips && <SeriesPips bestOf={bestOf!} us={nUs} them={nThem} />}
    </>
  );
}

/** Une victoire se fête une fois par visite, le temps que la scène se pose et que la série soit racontée. */
export function VictoryMoment({ id, games = 0 }: { id: string; games?: number }) {
  const self = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const key = `clutch:fete:${id}`;
    if (once(key)) return;
    let timer = 0;
    const arena = self.current?.closest<HTMLElement>(".arena");
    const begin = () => {
      if (arena?.hasAttribute("data-arrived") && !arena.hasAttribute("data-landed")) {
        timer = window.setTimeout(begin, 80);
        return;
      }
      timer = window.setTimeout(() => {
        if (!arena) return;
        mark(key);
        victory(arena);
      }, 750 + games * STEP_MS);
    };
    begin();
    return () => clearTimeout(timer);
  }, [id, games]);
  return <span ref={self} hidden />;
}

/** Un score exact : l'or jaillit du verdict, une fois par visite. */
export function ExactMoment({ id }: { id: string }) {
  const self = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const key = `clutch:exact:${id}`;
    if (once(key) || quiet()) return;
    const timer = setTimeout(() => {
      const box = self.current?.parentElement?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > innerHeight) return;
      mark(key);
      goldBurst(box.x + box.width / 2, box.y + box.height / 2);
    }, 500);
    return () => clearTimeout(timer);
  }, [id]);
  return <span ref={self} hidden />;
}
