import { logoFile } from "@/lib/logo-url";
import { flyBack, rememberScroll } from "./back";
import { flipPlay, flipRecord } from "./flip";
import { flyTo, fxLayer, ghostLogo, OUT, quiet, type Rect, screenSize, SPRING } from "./fx";
import { type IntroHandle, playIntro } from "./intro";

/**
 * Tout ce qui se passe entre le clic et la nouvelle page, sans jamais retenir la navigation :
 * Next navigue comme d'habitude, ceci ne fait que l'accompagner. Rien ici n'est rendu par React,
 * tout vit dans #fx-layer et disparaît au plus tard à l'expiration de GIVE_UP_MS.
 *
 *   clic    un trait de lumière part en haut de page, une onde sous le doigt ;
 *   ~100 ms la page quittée s'efface, et si le lien vient d'une carte, celle-ci et ses logos
 *           s'envolent vers leur place dans la page suivante, avant même qu'elle n'arrive ;
 *   ~260 ms si le serveur tarde, le squelette de la page s'affiche ;
 *   arrivée la carte et les logos se posent exactement sur la vraie scène, puis s'effacent.
 *
 * Un lien vers un match, lui, ouvre toujours sur le VS (intro.ts). Le retour arrière fait le trajet
 * inverse (back.ts).
 */

const GIVE_UP_MS = 12_000;
const SLOW_MS = 260;

type Kind = "match" | "team" | "competition";


function kindOf(pathname: string): Kind | null {
  if (pathname.startsWith("/match/")) return "match";
  if (pathname.startsWith("/equipe/") || pathname.startsWith("/equipes/")) return "team";
  if (pathname.startsWith("/competition/")) return "competition";
  return null;
}

const here = () => location.pathname + location.search;

// ───────────  Où la scène de la page suivante apparaîtra  ───────────

/** La géométrie réelle des dernières arrivées : la meilleure estimation pour les suivantes. */
const learned: Partial<Record<Kind, { height: number; logos: Rect[]; width: number }>> = {};

function contentBox(): { x: number; y: number; width: number } {
  const main = document.querySelector("main");
  if (!main) return { x: 16, y: 120, width: screenSize().W - 32 };
  const style = getComputedStyle(main);
  const box = main.getBoundingClientRect();
  return {
    x: box.x + parseFloat(style.paddingLeft),
    // Position à défilement nul : la page suivante s'ouvre en haut.
    y: box.y + scrollY + parseFloat(style.paddingTop),
    width: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
  };
}

function estimate(kind: Kind, count: number): { card: Rect; logos: Rect[] } {
  const c = contentBox();
  const { W } = screenSize();
  const wide = W >= 640;
  const large = W >= 1024;
  const known = learned[kind];
  if (known && Math.abs(known.width - c.width) < 2) {
    return { card: { x: c.x, y: c.y, width: c.width, height: known.height }, logos: known.logos.map((r) => ({ ...r, x: r.x + c.x, y: r.y + c.y })) };
  }
  if (kind === "competition") return { card: { x: c.x, y: c.y, width: c.width, height: large ? 190 : 170 }, logos: [] };
  if (kind === "team") {
    const s = wide ? 112 : 80;
    const pad = wide ? 32 : 20;
    const h = wide ? 176 : 150;
    return { card: { x: c.x, y: c.y, width: c.width, height: h }, logos: [{ x: c.x + pad, y: c.y + (h - s) / 2, width: s, height: s }] };
  }
  const s = large ? 112 : wide ? 96 : 64;
  const h = large ? 360 : wide ? 310 : 380;
  const top = wide ? 74 : 62;
  const logos = [
    { x: c.x + c.width * (wide ? 0.215 : 0.26) - s / 2, y: c.y + top, width: s, height: s },
    { x: c.x + c.width * (wide ? 0.785 : 0.74) - s / 2, y: c.y + top, width: s, height: s },
  ];
  return { card: { x: c.x, y: c.y, width: c.width, height: h }, logos: logos.slice(0, Math.max(count, 1)) };
}

// ───────────  Une navigation en cours  ───────────

interface Flight {
  card: HTMLElement;
  logos: { el: HTMLImageElement; file: string }[];
  kind: Kind;
  hidden: HTMLElement[];
}

interface Pending {
  from: string;
  soft: boolean;
  flight?: Flight;
  intro?: IntroHandle;
  timers: number[];
  progress?: HTMLElement;
}

let pending: Pending | null = null;
/** La page affichée : au retour arrière, c'est d'elle qu'on revient. */
let shownPath = "";

function startProgress(color: string): HTMLElement | undefined {
  const layer = fxLayer();
  if (!layer) return undefined;
  layer.querySelector(".fx-progress")?.remove();
  const bar = document.createElement("div");
  bar.className = "fx-progress";
  bar.style.setProperty("--c", color);
  layer.append(bar);
  // Vite au début, puis de plus en plus lentement : il n'atteint jamais la fin sans la page.
  bar.animate(
    [
      { transform: "scaleX(0)", offset: 0 },
      { transform: "scaleX(0.55)", offset: 0.06 },
      { transform: "scaleX(0.78)", offset: 0.25 },
      { transform: "scaleX(0.94)", offset: 1 },
    ],
    { duration: GIVE_UP_MS, easing: "linear", fill: "forwards" },
  );
  return bar;
}

function endProgress(bar?: HTMLElement) {
  if (!bar) return;
  const now = getComputedStyle(bar).transform;
  for (const a of bar.getAnimations()) a.cancel();
  bar.animate([{ transform: now }, { transform: "scaleX(1)" }], { duration: 180, easing: OUT, fill: "forwards" });
  bar.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 420, fill: "forwards" }).finished.then(
    () => bar.remove(),
    () => bar.remove(),
  );
}

function ripple(x: number, y: number, color: string) {
  const layer = fxLayer();
  if (!layer || quiet()) return;
  const dot = document.createElement("span");
  dot.className = "fx-ripple";
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  dot.style.setProperty("--c", color);
  layer.append(dot);
  dot.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.75 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
    ],
    { duration: 520, easing: OUT },
  ).finished.then(
    () => dot.remove(),
    () => dot.remove(),
  );
}

/** Les logos d'une carte, un par fichier : une équipe qui y figure deux fois ne s'envole qu'une fois. */
function logosIn(card: Element): HTMLImageElement[] {
  const seen = new Set<string>();
  const out: HTMLImageElement[] = [];
  for (const img of card.querySelectorAll<HTMLImageElement>("img:not(.backlight):not(.watermark)")) {
    const r = img.getBoundingClientRect();
    if (!img.src || r.width < 8 || r.bottom < 0 || r.top > screenSize().H) continue;
    const file = logoFile(img.src);
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(img);
  }
  return out;
}

function startFlight(card: Element, kind: Kind): Flight | undefined {
  const layer = fxLayer();
  if (!layer) return undefined;
  const logos = logosIn(card).slice(0, kind === "match" ? 2 : 1);
  const source = card.getBoundingClientRect();
  const plan = estimate(kind, logos.length);
  const [ca, cb] = (card.getAttribute("data-colors") ?? ",").split(",");
  const hi = (card.getAttribute("data-logos") ?? "|").split("|");
  const radius = getComputedStyle(card).borderRadius || "14px";

  const ghost = document.createElement("div");
  ghost.className = "fx-card";
  if (ca) ghost.style.setProperty("--a", ca);
  // Une carte à une seule équipe n'a qu'une lumière.
  ghost.style.setProperty("--b", cb || "transparent");
  Object.assign(ghost.style, { left: `${source.x}px`, top: `${source.y}px`, width: `${source.width}px`, height: `${source.height}px`, borderRadius: radius });
  layer.append(ghost);
  ghost.animate(
    [
      { left: `${source.x}px`, top: `${source.y}px`, width: `${source.width}px`, height: `${source.height}px`, borderRadius: radius },
      { left: `${plan.card.x}px`, top: `${plan.card.y}px`, width: `${plan.card.width}px`, height: `${plan.card.height}px`, borderRadius: "22px" },
    ],
    { duration: 460, easing: OUT, fill: "both" },
  );

  const hidden: HTMLElement[] = [];
  const flying = logos.map((img, i) => {
    const el = ghostLogo(layer, img.currentSrc || img.src, img.getBoundingClientRect(), hi[i] || undefined);
    img.style.visibility = "hidden";
    hidden.push(img);
    if (plan.logos[i]) flyTo(el, plan.logos[i], 520, SPRING);
    return { el, file: logoFile(img.src) };
  });
  return { card: ghost, logos: flying, kind, hidden };
}

/** La vraie scène est là : tout se pose dessus, et le relais se fait sans que ça se voie. */
function land(flight: Flight, reveal: () => void) {
  const page = document.querySelector("main .page-enter");
  const arena = page?.querySelector<HTMLElement>(".arena");
  if (!arena) {
    fadeOut([flight.card, ...flight.logos.map((l) => l.el)]);
    reveal();
    return;
  }
  const box = arena.getBoundingClientRect();
  const targets = [...arena.querySelectorAll<HTMLImageElement>("img:not(.backlight):not(.watermark)")].filter((img) => !img.closest(".dock"));
  const pairs = flight.logos.map((l) => ({ ...l, target: targets.find((t) => logoFile(t.src) === l.file) }));
  for (const p of pairs) if (p.target) p.target.style.visibility = "hidden";

  // Ce qu'on a mesuré servira d'estimation au prochain clic.
  const c = contentBox();
  learned[flight.kind] = {
    width: c.width,
    height: box.height,
    logos: pairs.flatMap((p) => {
      const r = p.target?.getBoundingClientRect();
      return r ? [{ x: r.x - c.x, y: r.y + scrollY - c.y, width: r.width, height: r.height }] : [];
    }),
  };

  const from = flight.card.getBoundingClientRect();
  for (const a of flight.card.getAnimations()) a.cancel();
  Object.assign(flight.card.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, borderRadius: "22px" });
  flight.card.animate(
    [
      { left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, height: `${from.height}px` },
      { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` },
    ],
    { duration: 300, easing: OUT, fill: "both" },
  );

  const landings = pairs.map((p) => {
    if (p.target) return flyTo(p.el, p.target.getBoundingClientRect(), 380, SPRING);
    fadeOut([p.el]);
    return undefined;
  });
  Promise.all(landings).then(async () => {
    arena.setAttribute("data-landed", "");
    reveal();
    // La carte fantôme couvre encore la vraie scène : ses logos restent jusqu'à ce qu'elle soit partie.
    await flight.card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished.catch(() => undefined);
    flight.card.remove();
    for (const p of pairs) {
      if (p.target) p.target.style.visibility = "";
      if (p.target) p.el.remove();
    }
  });
}

function fadeOut(els: HTMLElement[]) {
  for (const el of els) {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-out", fill: "forwards" }).finished.then(
      () => el.remove(),
      () => el.remove(),
    );
  }
}

function clearTimers(p: Pending) {
  for (const t of p.timers) clearTimeout(t);
  p.timers = [];
}

function setNav(value: string | null) {
  const root = document.documentElement;
  if (value) {
    root.setAttribute("data-nav", value);
  } else {
    root.removeAttribute("data-nav");
    root.removeAttribute("data-nav-slow");
  }
}

/** Abandon : rien ne reste à l'écran, l'ancienne page revient telle quelle. */
function abort() {
  const p = pending;
  if (!p) return;
  pending = null;
  clearTimers(p);
  setNav(null);
  document.documentElement.removeAttribute("data-slide");
  p.intro?.cancel();
  endProgress(p.progress);
  if (p.flight) {
    for (const el of p.flight.hidden) el.style.visibility = "";
    fadeOut([p.flight.card, ...p.flight.logos.map((l) => l.el)]);
  }
  document.querySelectorAll<HTMLElement>("[data-arrived]").forEach((el) => el.setAttribute("data-landed", ""));
}

/** L'adresse a changé et le nouveau contenu est dans le DOM, pas encore à l'écran. */
function committed() {
  const p = pending;
  if (!p) return;
  pending = null;
  shownPath = location.pathname;
  clearTimers(p);
  endProgress(p.progress);
  flipPlay();
  window.setTimeout(() => document.documentElement.removeAttribute("data-slide"), 700);
  if (p.soft || (!p.flight && !p.intro)) {
    setNav(null);
    return;
  }
  // Avant la première image : la scène attend son relais au lieu de jouer sa propre entrée.
  document.documentElement.removeAttribute("data-nav-slow");
  const page = document.querySelector<HTMLElement>("main .page-enter");
  const arena = page?.querySelector<HTMLElement>(".arena");
  page?.setAttribute("data-arrived", "");
  arena?.setAttribute("data-arrived", "");
  const flight = p.flight;
  const intro = p.intro;
  requestAnimationFrame(() => {
    setNav(null);
    const settle = () => arena?.setAttribute("data-landed", "");
    if (intro) intro.commit(arena ?? null, settle);
    else if (flight) land(flight, settle);
    else settle();
  });
}

// ───────────  Le clic  ───────────

function linkOf(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.origin !== location.origin) return null;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  // Un fichier (flux d'agenda…) n'ouvre pas de page.
  if (/\.[a-z0-9]+$/i.test(a.pathname)) return null;
  if (a.pathname + a.search === here()) return null;
  return a;
}

const SEEN_KEY = "clutch:intros";

/** Un match déjà ouvert garde son VS, en version plus vive. */
function introAlreadySeen(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}

function rememberIntro(id: string) {
  try {
    const seen = (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]).filter((s) => s !== id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([id, ...seen].slice(0, 200)));
  } catch {
    // Sans stockage, l'intro se rejoue : rien de grave.
  }
}

function onClick(e: MouseEvent) {
  const a = linkOf(e);
  if (!a) return;
  abort();
  rememberScroll();
  const soft = a.pathname === location.pathname && a.pathname !== "/";
  const color = getComputedStyle(a).getPropertyValue("--accent").trim() || "#4c8dff";
  const p: Pending = { from: here(), soft, timers: [] };
  pending = p;
  p.progress = startProgress(color);
  ripple(e.clientX, e.clientY, color);
  setNav(soft ? "soft" : "page");
  p.timers.push(window.setTimeout(abort, GIVE_UP_MS));
  // Sur une même page, un filtre réarrange les cartes : on note où elles sont.
  if (a.pathname === location.pathname) flipRecord();
  // Le calendrier glisse dans le sens où l'on va.
  const direction = a.getAttribute("data-slide");
  if (direction && !quiet()) document.documentElement.setAttribute("data-slide", direction);
  // Un lien vers un endroit précis (« Regarder ») veut y être tout de suite : pas de mise en scène.
  if (soft || quiet() || a.hash) return;

  const kind = kindOf(a.pathname);
  const card = a.closest("[data-morph]");
  const sameKind = card && card.getAttribute("data-morph") === kind;

  if (kind === "match") {
    // Le VS, à chaque feuille de match. L'adresse dit le jeu : match/<jeu>:<date>:<équipes>.
    const id = decodeURIComponent(a.pathname.slice("/match/".length));
    const short = introAlreadySeen(id);
    rememberIntro(id);
    setNav("intro");
    p.intro = playIntro({
      source: sameKind ? card : a,
      colors: ((sameKind && card.getAttribute("data-colors")) || ",").split(","),
      names: ((sameKind && card.getAttribute("data-names")) || "|").split("|"),
      logos: ((sameKind && card.getAttribute("data-logos")) || "|").split("|"),
      game: id.split(":")[0] || null,
      short,
    });
  } else if (kind) {
    const origin = sameKind ? card : a;
    if (sameKind || logosIn(a).length) {
      p.flight = startFlight(origin, kind);
      setNav("morph");
    }
  }
  // La page quittée vient de s'effacer : on remonte sans que ça se voie, la scène s'ouvre en haut.
  if (p.flight || p.intro) p.timers.push(window.setTimeout(() => scrollTo({ top: 0, behavior: "instant" }), 190));
  p.timers.push(
    window.setTimeout(() => {
      if (pending !== p) return;
      if (!p.flight && !p.intro) scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.setAttribute("data-nav-slow", "");
    }, SLOW_MS),
  );
}

/** Installe l'accompagnement ; renvoie de quoi tout retirer. */
export function watchNavigation(): () => void {
  shownPath = location.pathname;
  const check = () => {
    if (pending && here() !== pending.from) committed();
  };
  const onPop = () => {
    const from = shownPath;
    shownPath = location.pathname;
    if (pending) {
      check();
      return;
    }
    if (from !== location.pathname) flyBack(from);
  };
  // Une mutation arrive avant la première image de la nouvelle page : c'est le bon moment.
  const mo = new MutationObserver(check);
  const main = document.querySelector("main");
  if (main) mo.observe(main, { childList: true, subtree: true });
  addEventListener("click", onClick, true);
  addEventListener("popstate", onPop);
  return () => {
    mo.disconnect();
    removeEventListener("click", onClick, true);
    removeEventListener("popstate", onPop);
    abort();
  };
}

/** Filet de sécurité : le routeur signale qu'on est arrivé, même si rien n'a bougé dans la page. */
export function navigationSettled() {
  if (pending && here() !== pending.from) committed();
}
