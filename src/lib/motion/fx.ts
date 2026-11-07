export type Rect = { x: number; y: number; width: number; height: number };

export const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const SPRING_CURVE = "linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)";

/** Dépasse un peu sa cible avant de s'y poser, là où le navigateur sait le faire. */
export const SPRING = typeof CSS !== "undefined" && CSS.supports("animation-timing-function", SPRING_CURVE) ? SPRING_CURVE : OUT;

export const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** La taille de l'écran, telle que la voit #fx-layer. */
export const screenSize = () => ({ W: document.documentElement.clientWidth, H: document.documentElement.clientHeight });

/** Déplace un élément déjà posé en `fixed` vers `to`, en partant d'où il se trouve à cet instant. */
export function flyTo(el: HTMLElement, to: Rect, duration: number, easing: string): Promise<unknown> {
  const from = el.getBoundingClientRect();
  for (const a of el.getAnimations()) a.cancel();
  el.style.left = `${to.x}px`;
  el.style.top = `${to.y}px`;
  el.style.width = `${to.width}px`;
  el.style.height = `${to.height}px`;
  const a = el.animate(
    [{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.width / Math.max(1, to.width)}, ${from.height / Math.max(1, to.height)})` }, { transform: "none" }],
    { duration, easing, fill: "both" },
  );
  return a.finished.catch(() => undefined);
}

export function fxLayer(): HTMLElement | null {
  return document.getElementById("fx-layer");
}

export function ghostLogo(layer: HTMLElement, src: string, at: Rect, hi?: string): HTMLImageElement {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.className = "fx-logo";
  Object.assign(img.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${at.width}px`, height: `${at.height}px` });
  layer.append(img);
  if (hi && hi !== src) {
    const better = new Image();
    better.referrerPolicy = "no-referrer";
    better.onload = () => {
      img.src = hi;
    };
    better.src = hi;
  }
  return img;
}

