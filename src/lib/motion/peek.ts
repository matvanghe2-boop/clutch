import { fxLayer, OUT, quiet, screenSize } from "./fx";

/**
 * L'aperçu au survol : une mini-carte au-dessus d'un lien d'équipe ou de match, sans cliquer. À la
 * souris, après un court arrêt sur le lien ; au doigt, par un appui long. Les données viennent de
 * /api/apercu, gardées en mémoire pour la visite.
 */

interface Peek {
  kind: "team" | "match";
  name: string;
  game: string;
  logo?: string;
  color?: string;
  form?: string[];
  rank?: string;
  next?: string;
  them?: { name: string; logo?: string; color?: string };
  center?: string;
  detail?: string;
}

const SELECTOR = 'a[href^="/equipe/"], a[href^="/equipes/"], a[href^="/match/"]';
const cache = new Map<string, Promise<Peek | null>>();

function load(href: string): Promise<Peek | null> {
  const key = href.split("#")[0];
  if (!cache.has(key)) {
    const p = fetch(`/api/apercu?href=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Peek | null>) : null))
      .catch(() => null)
      .then((peek) => {
        // Rien reçu : on n'en garde pas le souvenir, le prochain survol redemandera.
        if (!peek) cache.delete(key);
        return peek;
      });
    cache.set(key, p);
  }
  return cache.get(key)!;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const logo = (src?: string) => (src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : `<span class="peek-blank"></span>`);
const chip = (r: string) => `<i class="peek-chip peek-${r}">${r === "win" ? "V" : r === "loss" ? "D" : "N"}</i>`;

function html(p: Peek): string {
  if (p.kind === "match") {
    return `<div class="peek-duel">
      <span class="peek-side">${logo(p.logo)}<b>${esc(p.name)}</b></span>
      <span class="peek-center display">${esc(p.center ?? "VS")}</span>
      <span class="peek-side">${logo(p.them?.logo)}<b>${esc(p.them?.name ?? "À déterminer")}</b></span>
    </div>
    <div class="peek-line">${esc(p.game)}${p.detail ? ` · ${esc(p.detail)}` : ""}</div>`;
  }
  return `<div class="peek-team">${logo(p.logo)}<div><b class="display">${esc(p.name)}</b><span class="peek-line">${esc(p.game)}${p.rank ? ` · ${esc(p.rank)}` : ""}</span></div></div>
    ${p.form?.length ? `<div class="peek-form">${p.form.slice(0, 8).map(chip).join("")}</div>` : ""}
    ${p.next ? `<div class="peek-line">Prochain : ${esc(p.next)}</div>` : ""}`;
}

export function watchPeek(): () => void {
  const layer = fxLayer();
  if (!layer) return () => undefined;
  const card = document.createElement("div");
  card.className = "peek";
  layer.append(card);
  let timer = 0;
  let current: HTMLAnchorElement | null = null;
  let pressed = false;

  const hide = () => {
    clearTimeout(timer);
    current = null;
    card.removeAttribute("data-on");
  };

  const show = async (a: HTMLAnchorElement) => {
    const p = await load(a.getAttribute("href") ?? "");
    if (current !== a || !p) return;
    card.innerHTML = html(p);
    card.style.setProperty("--c", p.color ?? "var(--accent)");
    if (p.them?.color) card.style.setProperty("--c2", p.them.color);
    const box = a.getBoundingClientRect();
    const { W, H } = screenSize();
    card.style.left = "0px";
    card.style.top = "0px";
    card.setAttribute("data-on", "");
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const x = Math.min(W - w - 10, Math.max(10, box.left + box.width / 2 - w / 2));
    const above = box.top - h - 12 > 70;
    const y = above ? box.top - h - 10 : Math.min(H - h - 10, box.bottom + 10);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.transformOrigin = `${box.left + box.width / 2 - x}px ${above ? "100%" : "0"}`;
    if (!quiet()) card.animate([{ opacity: 0, transform: `translateY(${above ? 6 : -6}px) scale(0.96)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: OUT });
  };

  // À la souris : un arrêt d'un tiers de seconde sur le lien.
  const over = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(SELECTOR) ?? null;
    if (a === current) return;
    hide();
    if (!a || a.closest("#fx-layer") || a.pathname === location.pathname) return;
    current = a;
    timer = window.setTimeout(() => show(a), 380);
  };

  // Au doigt : un appui long ; le clic qui suit est alors annulé.
  const touchStart = (e: TouchEvent) => {
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(SELECTOR) ?? null;
    hide();
    if (!a || a.pathname === location.pathname) return;
    current = a;
    timer = window.setTimeout(() => {
      pressed = true;
      show(a);
    }, 480);
  };
  const touchEnd = () => clearTimeout(timer);
  const click = (e: MouseEvent) => {
    if (!pressed) return;
    pressed = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const away = (e: Event) => {
    if (card.hasAttribute("data-on") && !(e.target as Element | null)?.closest?.(".peek")) hide();
  };

  addEventListener("pointerover", over, { passive: true });
  addEventListener("touchstart", touchStart, { passive: true });
  addEventListener("touchend", touchEnd, { passive: true });
  addEventListener("touchmove", touchEnd, { passive: true });
  addEventListener("click", click, true);
  addEventListener("scroll", hide, { passive: true });
  addEventListener("pointerdown", away, true);
  return () => {
    removeEventListener("pointerover", over);
    removeEventListener("touchstart", touchStart);
    removeEventListener("touchend", touchEnd);
    removeEventListener("touchmove", touchEnd);
    removeEventListener("click", click, true);
    removeEventListener("scroll", hide);
    removeEventListener("pointerdown", away, true);
    card.remove();
  };
}
