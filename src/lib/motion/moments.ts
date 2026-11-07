import { fxLayer, OUT, quiet, screenSize, SPRING } from "./fx";

/**
 * Les grands moments d'un match. Le score arrive avec le retard de Liquipedia : ces effets se
 * jouent quand la donnée change sur la page, pas à l'instant réel du jeu.
 */

function shake(el: HTMLElement, force: number, duration: number) {
  el.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${-force}px, ${force * 0.6}px)` },
      { transform: `translate(${force * 0.8}px, ${-force * 0.7}px)` },
      { transform: `translate(${-force * 0.5}px, ${force * 0.3}px)` },
      { transform: "translate(0, 0)" },
    ],
    { duration, easing: "linear" },
  );
}

/** Une équipe marque : le chiffre s'imprime et une onde à ses couleurs traverse la scène. */
export function scoreImpact(num: HTMLElement, side: "a" | "b") {
  if (quiet()) return;
  num.animate(
    [
      { transform: "scale(2.6) skewX(-8deg)", filter: "brightness(2.6)" },
      { transform: "none", filter: "none" },
    ],
    { duration: 700, easing: SPRING },
  );
  const arena = num.closest<HTMLElement>(".arena");
  if (!arena) return;
  const wave = document.createElement("span");
  wave.className = `fx-wave fx-wave-${side}`;
  arena.append(wave);
  const [from, to] = side === "a" ? ["-110%", "110%"] : ["110%", "-110%"];
  wave.animate([{ transform: `translateX(${from}) skewX(-14deg)`, opacity: 1 }, { transform: `translateX(${to}) skewX(-14deg)`, opacity: 0.2 }], { duration: 900, easing: OUT }).finished.then(
    () => wave.remove(),
    () => wave.remove(),
  );
  shake(arena, 5, 320);
  arena
    .querySelector<HTMLElement>(side === "a" ? ".arena-left .arena-logo" : ".arena-right .arena-logo")
    ?.animate([{ scale: 1 }, { scale: 1.28, offset: 0.22 }, { scale: 1 }], { duration: 620, easing: "ease-out" });
}

/** Une pluie d'éclats dorés, depuis le logo du vainqueur. */
function goldBurst(x: number, y: number) {
  const layer = fxLayer();
  if (!layer) return;
  const { W } = screenSize();
  const count = W < 640 ? 22 : 40;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "fx-gold";
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    layer.append(piece);
    const angle = Math.random() * Math.PI * 2;
    const reach = 90 + Math.random() * Math.min(W * 0.42, 360);
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach * 0.7;
    const spin = (Math.random() - 0.5) * 720;
    piece
      .animate(
        [
          { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) rotate(${spin * 0.6}deg) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy + 240}px) rotate(${spin}deg) scale(0.5)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 800, easing: "cubic-bezier(0.12, 0.7, 0.4, 1)", fill: "forwards" },
      )
      .finished.then(
        () => piece.remove(),
        () => piece.remove(),
      );
  }
}

/** La victoire : un éclat doré traverse la scène et jaillit du logo. */
export function victory(arena: HTMLElement) {
  if (quiet()) return;
  const sweep = document.createElement("span");
  sweep.className = "fx-sweep";
  arena.append(sweep);
  sweep.animate([{ transform: "translateX(-120%) skewX(-18deg)" }, { transform: "translateX(120%) skewX(-18deg)" }], { duration: 1300, easing: OUT }).finished.then(
    () => sweep.remove(),
    () => sweep.remove(),
  );
  const logo = arena.querySelector<HTMLElement>(".arena-left .arena-logo");
  if (!logo) return;
  logo.animate([{ scale: 1 }, { scale: 1.3, offset: 0.25 }, { scale: 1 }], { duration: 900, easing: "ease-out" });
  const box = logo.getBoundingClientRect();
  goldBurst(box.x + box.width / 2, box.y + box.height / 2);
}

/** Chaque seconde de la dernière minute bat dans toute la scène ; les dix dernières, dans tout l'écran. */
export function countdownBeat(el: HTMLElement, seconds: number) {
  if (quiet()) return;
  const arena = el.closest<HTMLElement>(".arena");
  if (!arena) return;
  const strong = seconds <= 10;
  arena.animate(
    [
      { boxShadow: `0 0 ${strong ? 70 : 34}px ${strong ? 6 : 1}px color-mix(in srgb, var(--a) 60%, transparent)`, borderColor: "var(--a)" },
      { boxShadow: "0 0 0 0 transparent", borderColor: "var(--color-line)" },
    ],
    { duration: 820, easing: "ease-out" },
  );
  if (!strong) return;
  const layer = fxLayer();
  if (!layer) return;
  const v = document.createElement("span");
  v.className = "fx-vignette";
  layer.append(v);
  v.animate([{ opacity: 0.55 + (10 - seconds) * 0.04 }, { opacity: 0 }], { duration: 760, easing: "ease-out" }).finished.then(
    () => v.remove(),
    () => v.remove(),
  );
}

/** Zéro : la scène s'embrase. */
export function kickOff(el: HTMLElement) {
  if (quiet()) return;
  const arena = el.closest<HTMLElement>(".arena");
  el.animate(
    [
      { transform: "scale(2.8) skewX(-10deg)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 420, easing: SPRING },
  );
  if (!arena) return;
  const flash = document.createElement("span");
  flash.className = "fx-flash";
  arena.append(flash);
  flash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 700, easing: "ease-out" }).finished.then(
    () => flash.remove(),
    () => flash.remove(),
  );
  shake(arena, 8, 420);
}
