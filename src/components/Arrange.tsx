"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ORDER_COOKIE } from "@/lib/home-order";

export interface Block {
  id: string;
  label: string;
  node: React.ReactNode;
}

const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * L'accueil à sa façon : « Réorganiser » fait apparaître une poignée sur chaque bloc, qu'on fait
 * glisser à la souris ou au doigt (ou avec les flèches du clavier). L'ordre est gardé dans un cookie
 * de ce navigateur, que le serveur lit : la page s'affiche directement dans le bon ordre.
 */
export function Arrange({ blocks, initial }: { blocks: Block[]; initial: string[] }) {
  const known = new Set(blocks.map((b) => b.id));
  const start = [...initial.filter((id) => known.has(id)), ...blocks.map((b) => b.id).filter((id) => !initial.includes(id))];
  const [order, setOrder] = useState(start);
  const [editing, setEditing] = useState(false);
  const els = useRef(new Map<string, HTMLDivElement>());
  const before = useRef(new Map<string, number>());
  const drag = useRef<{ id: string; grab: number; y: number } | null>(null);
  const current = useRef(order);
  current.current = order;

  const save = (next: string[]) => {
    document.cookie = `${ORDER_COOKIE}=${next.join("~")}; path=/; max-age=31536000; samesite=lax`;
  };
  const remember = () => {
    before.current = new Map([...els.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
  };
  const move = (id: string, to: number) => {
    setOrder((list) => {
      const from = list.indexOf(id);
      if (from === to || to < 0 || to >= list.length) return list;
      remember();
      const next = [...list];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  };

  // Les autres blocs glissent jusqu'à leur nouvelle place ; celui qu'on tient reste sous le doigt.
  useLayoutEffect(() => {
    const d = drag.current;
    for (const [id, el] of els.current) {
      const was = before.current.get(id);
      const now = el.getBoundingClientRect().top;
      if (d?.id === id) {
        el.style.transform = "none";
        el.style.transform = `translateY(${d.y - d.grab - el.getBoundingClientRect().top}px)`;
        continue;
      }
      if (was === undefined || Math.abs(was - now) < 1 || quiet()) continue;
      el.animate([{ transform: `translateY(${was - now}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
    before.current = new Map();
  }, [order]);

  /**
   * Le glisser se suit sur toute la fenêtre : déplacer le bloc dans la page le retire puis le remet,
   * ce qui ferait perdre la capture du pointeur à sa poignée.
   */
  const onDown = (id: string) => (e: React.PointerEvent) => {
    const el = els.current.get(id);
    if (!el) return;
    e.preventDefault();
    drag.current = { id, grab: e.clientY - el.getBoundingClientRect().top, y: e.clientY };
    el.setAttribute("data-dragging", "");
    const moveTo = (ev: PointerEvent) => {
      const d = drag.current;
      const block = els.current.get(id);
      if (!d || !block) return;
      ev.preventDefault();
      d.y = ev.clientY;
      block.style.transform = "none";
      block.style.transform = `translateY(${d.y - d.grab - block.getBoundingClientRect().top}px)`;
      // Le bloc passe devant ou derrière son voisin dès qu'il en dépasse la moitié.
      const list = current.current;
      const index = list.indexOf(id);
      const prev = els.current.get(list[index - 1]);
      const next = els.current.get(list[index + 1]);
      const center = d.y - d.grab + block.offsetHeight / 2;
      if (prev) {
        const r = prev.getBoundingClientRect();
        if (center < r.top + r.height / 2) return move(id, index - 1);
      }
      if (next) {
        const r = next.getBoundingClientRect();
        if (center > r.top + r.height / 2) return move(id, index + 1);
      }
    };
    const end = () => {
      removeEventListener("pointermove", moveTo);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      drag.current = null;
      const block = els.current.get(id);
      if (block) {
        block.removeAttribute("data-dragging");
        const from = block.style.transform;
        block.style.transform = "";
        if (!quiet() && from && from !== "none") block.animate([{ transform: from }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      }
      save(current.current);
    };
    addEventListener("pointermove", moveTo, { passive: false });
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  };

  const byId = new Map(blocks.map((b) => [b.id, b]));
  return (
    <div className="arrange" data-editing={editing ? "" : undefined}>
      <div className="arrange-bar">
        <button type="button" className="arrange-toggle" onClick={() => setEditing(!editing)} aria-pressed={editing}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7 4v16M7 4 4 7m3-3 3 3M17 20V4m0 16-3-3m3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {editing ? "Terminé" : "Réorganiser"}
        </button>
      </div>
      {order.map((id) => {
        const b = byId.get(id);
        if (!b) return null;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) els.current.set(id, el);
              else els.current.delete(id);
            }}
            className="arrange-block"
          >
            {editing && (
              <button
                type="button"
                className="arrange-handle"
                aria-label={`Déplacer « ${b.label} » (flèches haut et bas)`}
                onPointerDown={onDown(id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const next = order.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1);
                  move(id, next);
                  const list = [...order];
                  list.splice(list.indexOf(id), 1);
                  list.splice(Math.max(0, Math.min(list.length, next)), 0, id);
                  save(list);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
                </svg>
                {b.label}
              </button>
            )}
            <div className="arrange-body">{b.node}</div>
          </div>
        );
      })}
    </div>
  );
}
