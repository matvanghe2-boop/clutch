import { quiet } from "./fx";

/**
 * Les cartes s'inclinent sous la souris et la lumière suit le curseur. Un seul écouteur pour tout
 * le site : il ne fait que poser des variables, le CSS (fx.css) en tire l'effet. Rien au tactile,
 * où il n'y a pas de survol à suivre.
 */

const SELECTOR = ".arena, .lift, .tile";

/** L'inclinaison maximale, en degrés : plus la carte est grande, plus elle doit bouger peu. */
function maxTilt(el: HTMLElement, width: number) {
  if (el.classList.contains("arena")) return 1.6;
  return width > 600 ? 1.8 : 5;
}

export function watchTilt(): () => void {
  if (quiet() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return () => undefined;
  let current: HTMLElement | null = null;
  let frame = 0;
  let event: PointerEvent | null = null;

  const release = () => {
    if (!current) return;
    current.removeAttribute("data-tilt");
    current.style.removeProperty("--px");
    current.style.removeProperty("--py");
    current = null;
  };

  const apply = () => {
    frame = 0;
    const e = event;
    if (!e) return;
    const target = e.target as Element | null;
    // Le tableau collé vit dans la scène, mais il ne doit pas la faire pencher.
    const el = target?.closest?.(".dock") ? null : (target?.closest?.(SELECTOR) as HTMLElement | null);
    if (el !== current) release();
    if (!el) return;
    current = el;
    const box = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(-1, ((e.clientX - box.left) / box.width) * 2 - 1));
    const py = Math.min(1, Math.max(-1, ((e.clientY - box.top) / box.height) * 2 - 1));
    const tilt = maxTilt(el, box.width);
    el.style.setProperty("--rx", `${(-py * tilt).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * tilt).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(e.clientX - box.left).toFixed(0)}px`);
    el.style.setProperty("--my", `${(e.clientY - box.top).toFixed(0)}px`);
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
    el.setAttribute("data-tilt", "");
  };

  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    event = e;
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const leave = () => {
    event = null;
    release();
  };

  addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  addEventListener("blur", leave);
  addEventListener("scroll", leave, { passive: true });
  return () => {
    removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", leave);
    removeEventListener("blur", leave);
    removeEventListener("scroll", leave);
    cancelAnimationFrame(frame);
    release();
  };
}
