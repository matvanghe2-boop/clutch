"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { predictScore } from "@/app/actions";

export interface DeckSide {
  name: string;
  short: string;
  logo?: string;
  color?: string;
}

export interface DeckCard {
  id: string;
  us: DeckSide;
  them: DeckSide;
  /** « Demain · 20:15 ». */
  when: string;
  tournament?: string;
  /** Scores possibles, côté mon équipe puis adversaire. */
  scores: [number, number][];
  /** « Bo5 » ; absent quand Liquipedia ne le donne pas encore. */
  format?: string;
}

const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Au-delà, le geste vaut un choix. */
const THRESHOLD = 110;

type Side = "us" | "them" | "draw";

/**
 * Les pronos de la semaine en cartes : on glisse à droite si mon équipe gagne, à gauche si c'est
 * l'adversaire, puis on choisit le score parmi ceux qui donnent ce vainqueur. Les flèches du clavier
 * et les boutons font la même chose. Chaque score part tout de suite (même action que la feuille de match).
 */
export function PickDeck({ cards }: { cards: DeckCard[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<Side | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; id: number } | null>(null);

  const card = cards[index];

  /** La carte s'envole du côté choisi, puis on demande le score. */
  const choose = (s: Side) => {
    const el = top.current;
    setError(null);
    if (!el || quiet() || s === "draw") {
      setSide(s);
      return;
    }
    const dir = s === "us" ? 1 : -1;
    const from = el.style.transform || "none";
    el.animate([{ transform: from }, { transform: `translateX(${dir * 140}%) rotate(${dir * 24}deg)`, opacity: 0 }], { duration: 380, easing: "cubic-bezier(0.4, 0, 0.8, 0.6)", fill: "forwards" }).finished.then(() => setSide(s));
  };

  const skip = () => {
    setSide(null);
    setError(null);
    setIndex((i) => i + 1);
  };

  const pick = async (score: [number, number]) => {
    if (!card || saving) return;
    setSaving(true);
    const form = new FormData();
    form.set("id", card.id);
    form.set("score", `${score[0]}-${score[1]}`);
    const result = await predictScore({}, form).catch(() => ({ status: "erreur" }));
    setSaving(false);
    if (result.status !== "enregistre") {
      setError(result.status === "commence" ? "Trop tard : le match a commencé." : result.status === "verrouille" ? "Déverrouille d'abord les réglages." : "Le pronostic n'est pas passé, réessaie.");
      return;
    }
    setSaved((n) => n + 1);
    skip();
  };

  // Le tas est vide : la page se met à jour (historique, compteur du menu).
  useEffect(() => {
    if (saved && index >= cards.length) router.refresh();
  }, [saved, index, cards.length, router]);

  // Les flèches : ← adversaire, → mon équipe, ↓ passer.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!card || side || (e.target as Element).closest("input, textarea")) return;
      if (e.key === "ArrowRight") choose("us");
      else if (e.key === "ArrowLeft") choose("them");
      else if (e.key === "ArrowDown") skip();
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  if (!cards.length) return null;

  if (!card) {
    return (
      <div className="deck-done panel">
        <span className="display text-2xl">Tout est pronostiqué</span>
        <span className="text-sm text-dim">{saved ? `${saved} pronostic${saved > 1 ? "s" : ""} de plus. ` : ""}Les prochains matchs arriveront ici dès qu&apos;ils seront annoncés.</span>
      </div>
    );
  }

  const winning = side === "draw" ? card.scores.filter(([a, b]) => a === b) : side === "us" ? card.scores.filter(([a, b]) => a > b) : side === "them" ? card.scores.filter(([a, b]) => a < b) : [];
  const drawable = card.scores.some(([a, b]) => a === b);

  const onDown = (e: React.PointerEvent) => {
    if (side || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = top.current;
    if (!d || !el || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x;
    const dy = (e.clientY - d.y) * 0.25;
    el.style.transform = `translate(${d.dx}px, ${dy}px) rotate(${d.dx / 16}deg)`;
    el.style.setProperty("--lean", String(Math.max(-1, Math.min(1, d.dx / THRESHOLD))));
  };
  const onUp = () => {
    const d = drag.current;
    const el = top.current;
    drag.current = null;
    if (!d || !el) return;
    if (Math.abs(d.dx) > THRESHOLD) {
      choose(d.dx > 0 ? "us" : "them");
      return;
    }
    const from = el.style.transform;
    el.style.transform = "";
    el.style.setProperty("--lean", "0");
    if (!quiet() && from) el.animate([{ transform: from }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  };

  return (
    <div className="deck" style={{ "--a": card.us.color ?? "var(--color-rl)", "--b": card.them.color ?? "var(--color-cs)" } as React.CSSProperties}>
      <div className="deck-count text-xs text-faint">
        {index + 1} / {cards.length}
      </div>
      <div className="deck-stack">
        {cards.slice(index + 1, index + 3).map((c, i) => (
          <div key={c.id} className="deck-card deck-under" style={{ "--depth": i + 1 } as React.CSSProperties} aria-hidden>
            <Face c={c} />
          </div>
        ))}
        {!side && (
          <div
            key={card.id}
            ref={top}
            className="deck-card deck-top"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            data-noswipe=""
          >
            <span className="deck-stamp deck-stamp-us display">{card.us.short}</span>
            <span className="deck-stamp deck-stamp-them display">{card.them.short}</span>
            <Face c={card} />
          </div>
        )}
        {side && (
          <div key={`${card.id}-score`} className="deck-card deck-scores" data-side={side}>
            <span className="text-xs text-faint">
              {side === "draw" ? "Match nul" : `${side === "us" ? card.us.name : card.them.name} gagne`} · le score ?{card.format ? ` (${card.format})` : " Format pas encore connu : Bo3, Bo5 ou Bo7."}
            </span>
            <div className="deck-score-list">
              {winning.map(([a, b]) => (
                <button key={`${a}-${b}`} type="button" disabled={saving} onClick={() => pick([a, b])} className="deck-score score">
                  {a}–{b}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-loss">{error}</p>}
            <button type="button" className="text-xs text-faint hover:text-dim" onClick={() => setSide(null)}>
              ← Changer de vainqueur
            </button>
          </div>
        )}
      </div>
      {!side && (
        <div className="deck-actions">
          <button type="button" onClick={() => choose("them")} className="deck-btn" aria-label={`${card.them.name} gagne`}>
            ← {card.them.short}
          </button>
          <button type="button" onClick={skip} className="deck-btn deck-skip">
            Passer
          </button>
          {drawable && (
            <button type="button" onClick={() => choose("draw")} className="deck-btn deck-skip">
              Nul
            </button>
          )}
          <button type="button" onClick={() => choose("us")} className="deck-btn" aria-label={`${card.us.name} gagne`}>
            {card.us.short} →
          </button>
        </div>
      )}
    </div>
  );
}

function Face({ c }: { c: DeckCard }) {
  return (
    <>
      <div className="deck-meta text-xs">
        <span className="text-[var(--a)]">{c.when}</span>
        {c.tournament && <span className="truncate text-faint">{c.tournament}</span>}
      </div>
      <div className="deck-duel">
        <Team s={c.us} />
        <span className="display text-2xl text-faint">VS</span>
        <Team s={c.them} />
      </div>
      <div className="deck-hint text-xs text-faint">
        <span>← {c.them.short} gagne</span>
        <span>{c.us.short} gagne →</span>
      </div>
    </>
  );
}

function Team({ s }: { s: DeckSide }) {
  return (
    <span className="deck-team">
      {s.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo de Liquipedia, sans proxy
        <img src={s.logo} alt="" referrerPolicy="no-referrer" draggable={false} />
      ) : (
        <span className="deck-blank" />
      )}
      <b className="display">{s.name}</b>
    </span>
  );
}
