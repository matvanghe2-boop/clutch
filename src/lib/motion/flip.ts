import { OUT, quiet, SPRING } from "./fx";

/**
 * Quand un filtre change le contenu d'une liste, ses cartes glissent vers leur nouvelle place au
 * lieu de sauter. On note où chacune se trouve avant, puis on rejoue le trajet une fois arrivé.
 * Positions en coordonnées de page : le lien peut aussi faire remonter en haut.
 */

type Spot = { x: number; y: number };
let before = new Map<string, Spot>();

export function flipRecord() {
  before = new Map();
  if (quiet()) return;
  for (const el of document.querySelectorAll<HTMLElement>("main [data-flip]")) {
    const r = el.getBoundingClientRect();
    before.set(el.getAttribute("data-flip") ?? "", { x: r.x + scrollX, y: r.y + scrollY });
  }
}

export function flipPlay() {
  if (!before.size) return;
  const old = before;
  before = new Map();
  requestAnimationFrame(() => {
    const { innerHeight: H } = window;
    let fresh = 0;
    for (const el of document.querySelectorAll<HTMLElement>("main [data-flip]")) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > H + 80) continue;
      const was = old.get(el.getAttribute("data-flip") ?? "");
      if (was) {
        const dx = was.x - (r.x + scrollX);
        const dy = was.y - (r.y + scrollY);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 560, easing: SPRING });
        }
      } else {
        el.animate([{ opacity: 0, transform: "translateY(16px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: Math.min(fresh, 8) * 34, easing: OUT, fill: "backwards" });
        fresh++;
      }
    }
  });
}
