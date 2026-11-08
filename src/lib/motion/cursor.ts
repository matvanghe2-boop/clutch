import { fxLayer, quiet } from "./fx";

/**
 * Le curseur de visée, à la souris seulement : un point qui suit exactement la souris, et un
 * réticule qui le rattrape en douceur. Sur un lien ou un bouton, le réticule se verrouille : il
 * encadre l'élément, à sa couleur. Les champs de saisie gardent le curseur habituel.
 */
const TARGETS = 'a[href], button:not([disabled]), [role="tab"], summary, label, select, input[type="range"], [data-tab-go]';

export function watchCursor(): () => void {
  if (quiet() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return () => undefined;
  const layer = fxLayer();
  if (!layer) return () => undefined;
  const dot = document.createElement("div");
  dot.className = "fx-dot";
  const ring = document.createElement("div");
  ring.className = "fx-ring";
  for (const c of ["tl", "tr", "bl", "br"]) {
    const corner = document.createElement("i");
    corner.className = `fx-ring-${c}`;
    ring.append(corner);
  }
  layer.append(ring, dot);
  document.documentElement.setAttribute("data-cursor", "");

  let x = -100;
  let y = -100;
  // Le réticule : position et taille actuelles, et celles qu'il vise.
  const now = { x: -100, y: -100, w: 34, h: 34 };
  const aim = { x: -100, y: -100, w: 34, h: 34 };
  let locked: Element | null = null;
  let frame = 0;
  let visible = false;

  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (locked && !locked.isConnected) locked = null;
    if (locked) {
      const r = locked.getBoundingClientRect();
      aim.x = r.left - 5;
      aim.y = r.top - 5;
      aim.w = r.width + 10;
      aim.h = r.height + 10;
    } else {
      aim.x = x - 17;
      aim.y = y - 17;
      aim.w = 34;
      aim.h = 34;
    }
    const k = locked ? 0.3 : 0.2;
    now.x += (aim.x - now.x) * k;
    now.y += (aim.y - now.y) * k;
    now.w += (aim.w - now.w) * k;
    now.h += (aim.h - now.h) * k;
    ring.style.transform = `translate(${now.x}px, ${now.y}px)`;
    ring.style.width = `${now.w}px`;
    ring.style.height = `${now.h}px`;
  };
  frame = requestAnimationFrame(loop);

  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX;
    y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    if (!visible) {
      visible = true;
      now.x = x - 17;
      now.y = y - 17;
      layer.setAttribute("data-cursor-on", "");
    }
    const target = (e.target as Element | null)?.closest?.(TARGETS) ?? null;
    const typing = (e.target as Element | null)?.closest?.('input:not([type="range"]), textarea, [contenteditable="true"]');
    layer.toggleAttribute("data-cursor-text", Boolean(typing));
    if (target !== locked) {
      locked = target;
      ring.toggleAttribute("data-lock", Boolean(target));
      if (target) ring.style.setProperty("--c", getComputedStyle(target).getPropertyValue("--accent") || "#fff");
    }
  };
  const down = () => ring.setAttribute("data-press", "");
  const up = () => ring.removeAttribute("data-press");
  // Hors de la fenêtre ou au-dessus d'un lecteur vidéo, le curseur n'est plus à nous.
  const leave = () => {
    visible = false;
    layer.removeAttribute("data-cursor-on");
  };
  const out = (e: MouseEvent) => {
    if (!e.relatedTarget || (e.relatedTarget as Element).tagName === "IFRAME") leave();
  };

  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerdown", down, { passive: true });
  addEventListener("pointerup", up, { passive: true });
  document.addEventListener("mouseout", out);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("pointermove", move);
    removeEventListener("pointerdown", down);
    removeEventListener("pointerup", up);
    document.removeEventListener("mouseout", out);
    document.documentElement.removeAttribute("data-cursor");
    ring.remove();
    dot.remove();
  };
}
