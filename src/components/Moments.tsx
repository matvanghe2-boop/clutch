"use client";

import { useEffect, useRef } from "react";
import { scoreImpact, victory } from "@/lib/motion/moments";

/**
 * Le score d'un match. La page se recharge seule pendant le direct : ce composant reste en place,
 * et quand un chiffre change, il joue le moment au lieu de le remplacer en silence.
 */
export function LiveScore({ us, them, dimUs, dimThem, className = "text-5xl sm:text-6xl lg:text-8xl" }: { us: number | string; them: number | string; dimUs?: boolean; dimThem?: boolean; className?: string }) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const previous = useRef({ us, them });
  useEffect(() => {
    if (previous.current.us !== us && a.current) scoreImpact(a.current, "a");
    if (previous.current.them !== them && b.current) scoreImpact(b.current, "b");
    previous.current = { us, them };
  }, [us, them]);
  return (
    <div className={`score ${className}`}>
      <span ref={a} className={`inline-block ${dimUs ? "text-dim" : ""}`}>
        {us}
      </span>
      <span className="px-2 text-faint">–</span>
      <span ref={b} className={`inline-block ${dimThem ? "text-dim" : ""}`}>
        {them}
      </span>
    </div>
  );
}

/** Une victoire se fête une fois par visite, le temps que la scène se pose. */
export function VictoryMoment({ id }: { id: string }) {
  const self = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const key = `clutch:fete:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      const arena = self.current?.closest<HTMLElement>(".arena");
      if (!arena) return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // Sans stockage, la fête recommencera : rien de grave.
      }
      victory(arena);
    }, 750);
    return () => clearTimeout(timer);
  }, [id]);
  return <span ref={self} hidden />;
}
