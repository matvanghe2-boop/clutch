"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface Tab {
  id: string;
  label: string;
  badge?: string | number;
  panel: React.ReactNode;
}

const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Des onglets pour les pages trop longues. Tout le contenu arrive d'un coup, comme une page unique :
 * changer d'onglet est instantané et ne demande rien au serveur. L'adresse suit (`?onglet=stats`),
 * pour partager un onglet ou le retrouver au rechargement ; le bouton retour quitte la page au lieu
 * de remonter les onglets un par un. Sur téléphone, on passe de l'un à l'autre en glissant le doigt.
 */
export function TabsView({ tabs, initial, leading }: { tabs: Tab[]; initial: string; leading?: React.ReactNode }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0].id);
  const bar = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const panels = useRef<HTMLDivElement>(null);
  const scrolls = useRef(new Map<string, number>());
  /** Le sens du dernier changement : le contenu arrive du côté de l'onglet choisi. */
  const direction = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (tabs.some((t) => t.id === initial)) setActive(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule une nouvelle page du serveur change l'onglet de départ
  }, [initial]);

  /** Où la barre se colle : plus haut, on ne touche pas au défilement. */
  const stickAt = useCallback(() => {
    const el = bar.current;
    if (!el) return 0;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 56;
    const holder = el.parentElement?.getBoundingClientRect().top ?? 0;
    return Math.max(0, holder + scrollY - header);
  }, []);

  const select = useCallback(
    (id: string) => {
      setActive((current) => {
        if (current === id) return current;
        direction.current = tabs.findIndex((t) => t.id === id) > tabs.findIndex((t) => t.id === current) ? 1 : -1;
        scrolls.current.set(current, scrollY);
        return id;
      });
      const url = new URL(location.href);
      if (id === tabs[0].id) url.searchParams.delete("onglet");
      else url.searchParams.set("onglet", id);
      url.hash = "";
      history.replaceState(null, "", url);
    },
    [tabs],
  );

  // Le trait glisse sous l'onglet actif, et celui-ci reste visible quand la barre défile.
  useLayoutEffect(() => {
    const place = () => {
      const tab = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!tab || !line.current) return;
      line.current.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    };
    place();
    const tab = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (tab && list.current && !first.current) list.current.scrollTo({ left: tab.offsetLeft - 24, behavior: quiet() ? "auto" : "smooth" });
    addEventListener("resize", place);
    document.fonts?.ready.then(place);
    return () => removeEventListener("resize", place);
  }, [active]);

  // Le contenu change : on le remet en haut de l'onglet, et il entre du bon côté.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const top = stickAt();
    if (scrollY > top) scrollTo({ top: Math.max(top, scrolls.current.get(active) ?? top), behavior: "instant" });
    const panel = panels.current?.querySelector<HTMLElement>(`[data-panel="${CSS.escape(active)}"]`);
    if (panel && !quiet() && direction.current) {
      panel.animate(
        [
          { opacity: 0, transform: `translateX(${direction.current * 42}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: 420, easing: OUT },
      );
    }
  }, [active, stickAt]);

  // La barre sait quand elle est collée : elle prend alors son fond et le logo de l'équipe.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = document.querySelector("header");
      if (!header) return;
      const height = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--header-h", `${height}px`);
      el.toggleAttribute("data-stuck", el.getBoundingClientRect().top <= header.getBoundingClientRect().bottom + 1);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue, { passive: true });
    return () => {
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Un lien vers un endroit précis de la page ouvre l'onglet qui le contient.
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const owner = target?.closest<HTMLElement>("[data-panel]")?.getAttribute("data-panel");
      if (!target || !owner || !panels.current?.contains(target)) return;
      setActive(owner);
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    open();
    addEventListener("hashchange", open);
    return () => removeEventListener("hashchange", open);
  }, []);

  const go = (step: number) => {
    const next = tabs[tabs.findIndex((t) => t.id === active) + step];
    if (next) select(next.id);
    return next;
  };

  // Le doigt : le contenu suit un peu le geste, puis l'onglet change s'il est allé assez loin.
  const touch = useRef<{ x: number; y: number; dx: number; locked: boolean } | null>(null);
  const currentPanel = () => panels.current?.querySelector<HTMLElement>(`[data-panel="${CSS.escape(active)}"]`);
  const onTouchStart = (e: React.TouchEvent) => {
    // Un tableau qu'on fait défiler de côté garde son geste.
    if ((e.target as Element).closest("[data-noswipe], .overflow-x-auto, input, textarea")) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, locked: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (!t.locked) {
      if (Math.abs(dy) > 12) touch.current = null;
      else if (Math.abs(dx) > 14) t.locked = true;
      return;
    }
    t.dx = dx;
    const panel = currentPanel();
    if (panel && !quiet()) {
      panel.style.transform = `translateX(${dx * 0.4}px)`;
      panel.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 520));
    }
  };
  const onTouchEnd = () => {
    const t = touch.current;
    touch.current = null;
    if (!t?.locked) return;
    const panel = currentPanel();
    if (panel) {
      panel.style.transform = "";
      panel.style.opacity = "";
    }
    if (Math.abs(t.dx) > 72) go(t.dx < 0 ? 1 : -1);
    else if (panel && !quiet()) panel.animate([{ transform: `translateX(${t.dx * 0.4}px)` }, { transform: "none" }], { duration: 320, easing: OUT });
  };

  return (
    <div className="tabs">
      <div ref={bar} className="tabbar">
        <div className="tabbar-inner">
          {leading && <span className="tabbar-lead">{leading}</span>}
          <div
            ref={list}
            className="tablist"
            role="tablist"
            aria-orientation="horizontal"
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = go(step);
              if (next) list.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)?.focus();
            }}
          >
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" data-tab={t.id} id={`onglet-${t.id}`} aria-selected={t.id === active} aria-controls={`panneau-${t.id}`} tabIndex={t.id === active ? 0 : -1} className="tab" onClick={() => select(t.id)}>
                {t.label}
                {t.badge !== undefined && t.badge !== 0 && <span className="tab-badge">{t.badge}</span>}
              </button>
            ))}
            <span ref={line} className="tab-line" aria-hidden />
          </div>
        </div>
      </div>
      <div
        ref={panels}
        className="tab-panels"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          const to = (e.target as Element).closest("[data-tab-go]")?.getAttribute("data-tab-go");
          if (to) select(to);
        }}
      >
        {tabs.map((t) => (
          <div key={t.id} id={`panneau-${t.id}`} role="tabpanel" aria-labelledby={`onglet-${t.id}`} data-panel={t.id} hidden={t.id !== active} className="space-y-10">
            {t.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
