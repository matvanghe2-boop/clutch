import { logoFile } from "@/lib/logo-url";
import { flyTo, fxLayer, ghostLogo, OUT, screenSize, SPRING } from "./fx";

/**
 * L'intro d'un match, une fois par match : l'écran se coupe en deux aux couleurs des équipes, les
 * logos se percutent au centre, puis la scène se dégage sur la vraie page. Un clic ou une touche
 * la passe. Le temps que le serveur réponde est masqué par la mise en place : la page arrive
 * pendant que les équipes se font face, et le choc part dès qu'elle est prête.
 */

export interface IntroHandle {
  /** La page est prête : `arena` reçoit les logos, `settle` lance le reste de la scène. */
  commit(arena: HTMLElement | null, settle: () => void): void;
  cancel(): void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const box = (cx: number, cy: number, size: number) => ({ x: cx - size / 2, y: cy - size / 2, width: size, height: size });

function div(className: string, parent: HTMLElement, text?: string) {
  const el = document.createElement("div");
  el.className = className;
  if (text) el.textContent = text;
  parent.append(el);
  return el;
}

/** Des éclats qui partent du point d'impact, chacun dans sa direction. */
function sparks(stage: HTMLElement, x: number, y: number) {
  const { W, H } = screenSize();
  const count = W < 640 ? 14 : 24;
  for (let i = 0; i < count; i++) {
    const s = div("intro-spark", stage);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const reach = (0.5 + Math.random() * 0.7) * Math.min(W, H) * 0.46;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty("--c", i % 2 ? "var(--a)" : "var(--b)");
    const deg = (angle * 180) / Math.PI;
    s.animate(
      [
        { transform: `rotate(${deg}deg) translateX(0) scaleX(0.3)`, opacity: 1 },
        { transform: `rotate(${deg}deg) translateX(${reach * 0.7}px) scaleX(1)`, opacity: 1, offset: 0.45 },
        { transform: `rotate(${deg}deg) translateX(${reach}px) scaleX(0.1)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 240, easing: "cubic-bezier(0.1, 0.8, 0.3, 1)", fill: "forwards" },
    );
  }
}

export function playIntro({ source, colors, names, logos }: { source: Element; colors: string[]; names: string[]; logos: string[] }): IntroHandle | undefined {
  const layer = fxLayer();
  if (!layer) return undefined;
  const stage = div("intro", layer);
  if (colors[0]) stage.style.setProperty("--a", colors[0]);
  if (colors[1]) stage.style.setProperty("--b", colors[1]);
  const halfA = div("intro-half intro-half-a", stage);
  const halfB = div("intro-half intro-half-b", stage);
  const seam = div("intro-seam", stage);
  const ring = div("intro-ring", stage);
  const flash = div("intro-flash", stage);
  const vs = div("intro-vs display", stage, "VS");
  const nameA = div("intro-name intro-name-a display", stage, names[0]);
  const nameB = div("intro-name intro-name-b display", stage, names[1]);

  const { W, H } = screenSize();
  const size = Math.round(Math.min(W * 0.34, H * 0.36, 280));
  const cy = H * 0.46;
  const standA = box(W * 0.26, cy, size);
  const standB = box(W * 0.74, cy, size);
  nameA.style.cssText = `left:${W * 0.26}px;top:${cy + size * 0.58}px;width:${W * 0.44}px`;
  nameB.style.cssText = `left:${W * 0.74}px;top:${cy + size * 0.58}px;width:${W * 0.44}px`;

  // Les logos partent de là où ils étaient dans la carte cliquée.
  const shown = [...source.querySelectorAll<HTMLImageElement>("img:not(.backlight)")].filter((i) => i.getBoundingClientRect().width > 6);
  const start = (i: number) => shown[i]?.getBoundingClientRect() ?? box(i ? W + size : -size, cy, size);
  const logoA = ghostLogo(stage, logos[0] || shown[0]?.src || "", start(0));
  const logoB = ghostLogo(stage, logos[1] || shown[1]?.src || "", start(1));
  logoA.classList.add("intro-logo");
  logoB.classList.add("intro-logo");
  logoA.style.setProperty("--glow", "var(--a)");
  logoB.style.setProperty("--glow", "var(--b)");

  // ─── La mise en place : les deux camps entrent et se font face. ───
  halfA.animate([{ transform: "translateX(-104%)" }, { transform: "none" }], { duration: 380, easing: OUT, fill: "both" });
  halfB.animate([{ transform: "translateX(104%)" }, { transform: "none" }], { duration: 380, easing: OUT, fill: "both" });
  seam.animate([{ opacity: 0, transform: "scaleY(0)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 160, easing: OUT, fill: "both" });
  flyTo(logoA, standA, 460, OUT);
  flyTo(logoB, standB, 460, OUT);
  nameA.animate([{ opacity: 0, transform: "translate(-50%, 18px) skewX(-8deg)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 420, delay: 180, easing: OUT, fill: "both" });
  nameB.animate([{ opacity: 0, transform: "translate(-50%, 18px) skewX(-8deg)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 420, delay: 180, easing: OUT, fill: "both" });

  let skipped = false;
  let closed = false;
  const shownAt = performance.now();

  const remove = () => {
    closed = true;
    removeEventListener("keydown", skip);
    stage.removeEventListener("pointerdown", skip);
    stage.remove();
  };
  function skip() {
    skipped = true;
  }
  addEventListener("keydown", skip);
  stage.addEventListener("pointerdown", skip);

  async function run(arena: HTMLElement | null, settle: () => void) {
    // Le temps de voir les deux camps, même si le serveur a répondu aussitôt.
    await wait(Math.max(0, 430 - (performance.now() - shownAt)));
    if (closed) return;

    if (!skipped) {
      // ─── Le choc. ───
      const cx = W / 2;
      const rush = 170;
      const easeIn = "cubic-bezier(0.55, 0, 0.9, 0.5)";
      flyTo(logoA, box(cx - size * 0.3, cy, size * 1.12), rush, easeIn);
      flyTo(logoB, box(cx + size * 0.3, cy, size * 1.12), rush, easeIn);
      await wait(rush);
      if (closed) return;
      flash.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" });
      ring.style.left = `${cx}px`;
      ring.style.top = `${cy}px`;
      ring.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.1)", opacity: 1 },
          { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
        ],
        { duration: 620, easing: OUT, fill: "forwards" },
      );
      sparks(stage, cx, cy);
      stage.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: "translate(-9px, 6px)" },
          { transform: "translate(8px, -7px)" },
          { transform: "translate(-6px, -3px)" },
          { transform: "translate(4px, 4px)" },
          { transform: "translate(-2px, 1px)" },
          { transform: "translate(0, 0)" },
        ],
        { duration: 340, easing: "linear" },
      );
      flyTo(logoA, box(cx - size * 0.82, cy, size), 620, SPRING);
      flyTo(logoB, box(cx + size * 0.82, cy, size), 620, SPRING);
      vs.style.left = `${cx}px`;
      vs.style.top = `${cy}px`;
      vs.animate(
        [
          { opacity: 0, transform: "translate(-50%, -50%) scale(2.6) skewX(-8deg)" },
          { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
        ],
        { duration: 300, easing: OUT, fill: "both" },
      );
      await wait(620);
      if (closed) return;
    }

    // ─── La scène se dégage sur la vraie page. ───
    stage.style.pointerEvents = "none";
    const leave = 460;
    const easing = "cubic-bezier(0.7, 0, 0.2, 1)";
    halfA.animate([{ transform: "none" }, { transform: "translateX(-104%)" }], { duration: leave, easing, fill: "forwards" });
    halfB.animate([{ transform: "none" }, { transform: "translateX(104%)" }], { duration: leave, easing, fill: "forwards" });
    for (const el of [vs, seam, nameA, nameB]) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });

    const targets = arena ? [...arena.querySelectorAll<HTMLImageElement>(".arena-logo img")] : [];
    for (const t of targets) t.style.visibility = "hidden";
    const landings = [logoA, logoB].map(async (el, i) => {
      // Par fichier : la carte d'un bracket peut placer nos équipes dans l'autre sens que la scène.
      const t = targets.find((img) => logoFile(img.src) === logoFile(el.src)) ?? targets[i];
      if (!t) {
        await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }).finished;
        return;
      }
      await flyTo(el, t.getBoundingClientRect(), leave + 120, SPRING);
      t.style.visibility = "";
      el.remove();
    });
    // La scène reprend la main pendant le mouvement, pour que l'heure s'imprime à l'arrivée.
    await wait(leave * 0.55);
    settle();
    await Promise.all(landings).catch(() => undefined);
    await wait(120);
    remove();
  }

  return {
    commit(arena, settle) {
      run(arena, settle).catch(() => {
        settle();
        remove();
      });
    },
    cancel: remove,
  };
}
