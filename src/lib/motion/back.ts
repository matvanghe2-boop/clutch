import { logoFile } from "@/lib/logo-url";
import { flyTo, fxLayer, ghostLogo, OUT, quiet, screenSize, SPRING } from "./fx";

/**
 * Le retour arrière : la grande scène redescend dans la carte d'où elle vient, au lieu d'un fondu.
 * Tout part de `popstate`, où l'ancienne page est encore à l'écran : on la photographie en fantômes,
 * puis on cherche sur la page retrouvée le lien qui menait là.
 */

let cleanup: (() => void) | null = null;

/**
 * La position de défilement de chaque page quittée par un clic. Le navigateur ne peut pas la
 * retrouver seul : on remonte la page au moment de partir, pour que la scène s'ouvre en haut.
 */
const positions = new Map<string, number>();

export function rememberScroll() {
  positions.set(location.pathname + location.search, scrollY);
}

function restoreScroll() {
  const y = positions.get(location.pathname + location.search);
  if (y) scrollTo({ top: y, behavior: "instant" });
}

/** Attend que la page retrouvée soit dans le DOM, puis lui rend sa position. */
function whenSwapped(page: Element | null, then: () => void): () => void {
  const main = document.querySelector("main");
  const mo = new MutationObserver(() => {
    if (document.querySelector("main .page-enter") === page) return;
    mo.disconnect();
    // Deux images : le navigateur a fini sa propre restauration, la nôtre passe en dernier.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        restoreScroll();
        then();
      }),
    );
  });
  if (main) mo.observe(main, { childList: true, subtree: true });
  return () => mo.disconnect();
}

function visible(r: DOMRect) {
  const { W, H } = screenSize();
  return r.width > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
}

function findOrigin(pathname: string): Element | null {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("main a[href], .ticker a[href], header a[href]")];
  for (const a of links) {
    if (a.pathname !== pathname || a.closest("[inert]")) continue;
    const card = a.closest("[data-morph]") ?? a;
    if (visible(card.getBoundingClientRect())) return card;
  }
  return null;
}

/** À appeler quand l'adresse vient de changer par le retour ou l'avance du navigateur. */
export function flyBack(from: string): void {
  cleanup?.();
  const layer = fxLayer();
  const page = document.querySelector("main .page-enter");
  const arena = page?.querySelector<HTMLElement>(".arena");
  const box = arena?.getBoundingClientRect();
  if (!layer || !arena || !box || quiet() || !visible(box)) {
    // Pas de scène à faire voler : la page retrouve au moins sa position.
    const stop = whenSwapped(page ?? null, () => stop());
    window.setTimeout(stop, 2500);
    return;
  }

  const style = getComputedStyle(arena);
  const ghost = document.createElement("div");
  ghost.className = "fx-card";
  ghost.style.setProperty("--a", style.getPropertyValue("--a").trim());
  ghost.style.setProperty("--b", arena.classList.contains("arena-solo") ? "transparent" : style.getPropertyValue("--b").trim());
  Object.assign(ghost.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, borderRadius: "22px" });
  layer.append(ghost);
  const logos = [...arena.querySelectorAll<HTMLImageElement>(".arena-logo img")].map((img) => ghostLogo(layer, img.currentSrc || img.src, img.getBoundingClientRect()));
  document.documentElement.setAttribute("data-nav", "morph");

  const finish = () => {
    window.clearTimeout(timer);
    stopWatching();
    cleanup = null;
    document.documentElement.removeAttribute("data-nav");
  };
  const fade = () => {
    for (const el of [ghost, ...logos]) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-out", fill: "forwards" }).finished.then(
        () => el.remove(),
        () => el.remove(),
      );
    }
  };
  // Si la page ne change jamais (retour dans la même vue), on efface sans insister.
  const timer = window.setTimeout(() => {
    finish();
    fade();
  }, 1800);
  cleanup = () => {
    finish();
    ghost.remove();
    for (const l of logos) l.remove();
  };

  const land = () => {
    finish();
    const origin = findOrigin(from);
    if (!origin) {
      fade();
      return;
    }
    const to = origin.getBoundingClientRect();
    const here = ghost.getBoundingClientRect();
    Object.assign(ghost.style, { left: `${to.x}px`, top: `${to.y}px`, width: `${to.width}px`, height: `${to.height}px` });
    const radius = getComputedStyle(origin).borderRadius || "14px";
    ghost.style.borderRadius = radius;
    const flight = ghost.animate(
      [
        { left: `${here.x}px`, top: `${here.y}px`, width: `${here.width}px`, height: `${here.height}px`, borderRadius: "22px", opacity: 1 },
        { left: `${to.x}px`, top: `${to.y}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: radius, opacity: 1, offset: 0.8 },
        { left: `${to.x}px`, top: `${to.y}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: radius, opacity: 0 },
      ],
      { duration: 480, easing: OUT, fill: "both" },
    );
    flight.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
    const targets = [...origin.querySelectorAll<HTMLImageElement>("img:not(.backlight):not(.watermark)")];
    for (const l of logos) {
      const t = targets.find((img) => logoFile(img.src) === logoFile(l.src));
      if (!t) {
        l.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(
          () => l.remove(),
          () => l.remove(),
        );
        continue;
      }
      t.style.visibility = "hidden";
      flyTo(l, t.getBoundingClientRect(), 460, SPRING).then(() => {
        t.style.visibility = "";
        l.remove();
      });
    }
  };

  const stopWatching = whenSwapped(page ?? null, land);
}
