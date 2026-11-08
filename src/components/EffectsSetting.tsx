"use client";

import { useEffect, useState } from "react";

type Level = "complet" | "sobre";
const KEY = "clutch:effets";

const CHOICES: { id: Level; label: string; detail: string }[] = [
  { id: "complet", label: "Complet", detail: "Le grand VS à chaque feuille de match, le fond animé, le curseur de visée, les cartes qui s'inclinent." },
  { id: "sobre", label: "Sobre", detail: "Un VS court, un fond immobile, le curseur normal, rien qui s'incline. Pour un téléphone lent ou la batterie." },
];

/**
 * L'intensité des effets, propre à ce navigateur. Gardée dans le stockage local et posée sur
 * <html> avant le premier affichage (voir MOTION_BOOT dans app/layout.tsx) ; la page se recharge
 * pour que tout reparte au bon niveau. « Réduire les animations » du système reste prioritaire.
 */
export function EffectsSetting() {
  const [level, setLevel] = useState<Level>("complet");
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "sobre") setLevel("sobre");
    } catch {}
  }, []);

  const choose = (next: Level) => {
    if (next === level) return;
    try {
      if (next === "sobre") localStorage.setItem(KEY, "sobre");
      else localStorage.removeItem(KEY);
    } catch {}
    setLevel(next);
    location.reload();
  };

  return (
    <div className="effects" role="radiogroup" aria-label="Intensité des effets">
      {CHOICES.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={level === c.id} className="effects-choice" data-level={c.id} onClick={() => choose(c.id)}>
          <span className="effects-preview" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="min-w-0 text-left">
            <b className="display block text-xl">{c.label}</b>
            <span className="block text-xs text-dim">{c.detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
