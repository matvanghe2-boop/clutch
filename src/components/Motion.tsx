"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { watchGlide } from "@/lib/motion/glide";
import { navigationSettled, watchNavigation } from "@/lib/motion/nav";
import { watchBackground } from "@/lib/motion/scenes";
import { watchTilt } from "@/lib/motion/tilt";
import { watchSections } from "@/lib/reveal";
import { cn } from "./ui";

/** Prévient l'accompagnement des navigations que le routeur est arrivé, même si rien n'a bougé. */
function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => navigationSettled(), [pathname, search]);
  return null;
}

/**
 * Lance tout ce qui anime le site. Une seule installation pour toute la visite : chaque module
 * voit arriver les nouvelles pages de lui-même, inutile de le relancer au changement d'adresse.
 */
export function MotionRoot() {
  useEffect(() => {
    // Rassure le script de layout.tsx : les sections cachées seront bien révélées.
    document.documentElement.setAttribute("data-motion-ready", "");
    const stops = [watchSections(), watchNavigation(), watchTilt(), watchBackground(), watchGlide()];
    return () => stops.forEach((stop) => stop());
  }, []);
  return (
    <Suspense fallback={null}>
      <RouteWatcher />
    </Suspense>
  );
}

/** Un lien de navigation : la page où l'on est le dit, et le trait glisse d'un onglet à l'autre. */
export function NavLink({ href, title, game, style, morph, children }: { href: string; title?: string; game?: string; style?: React.CSSProperties; morph?: Record<`data-${string}`, string>; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} title={title} data-game={game} style={style} {...morph} data-active={active ? "" : undefined} className={cn("nav-link")}>
      {children}
    </Link>
  );
}

/** Le trait sous l'onglet actif : un seul élément, qui se déplace, plutôt qu'un trait par onglet. */
export function NavIndicator() {
  const pathname = usePathname();
  const self = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = self.current;
    const nav = el?.parentElement;
    if (!el || !nav) return;
    const place = () => {
      const active = nav.querySelector<HTMLElement>(".nav-link[data-active]");
      if (!active) {
        el.style.opacity = "0";
        return;
      }
      el.style.opacity = "1";
      el.style.setProperty("--c", getComputedStyle(active).getPropertyValue("--accent"));
      el.style.transform = `translateX(${active.offsetLeft + 8}px) scaleX(${Math.max(0, active.offsetWidth - 16)})`;
      // L'onglet actif reste visible quand le menu défile sur un petit écran.
      const left = active.offsetLeft - nav.scrollLeft;
      if (left < 0 || left + active.offsetWidth > nav.clientWidth) nav.scrollTo({ left: active.offsetLeft - 16, behavior: "smooth" });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [pathname]);
  return <span ref={self} className="nav-indicator" aria-hidden />;
}

/** Au survol d'une équipe dans un bracket, tout son parcours s'allume. */
export function BracketHover({ children }: { children: React.ReactNode }) {
  const set = (root: HTMLElement, team: string | null) => {
    for (const el of root.querySelectorAll("[data-path]")) el.removeAttribute("data-path");
    if (!team) return;
    for (const el of root.querySelectorAll(`[data-team="${CSS.escape(team)}"]`)) el.setAttribute("data-path", "");
  };
  return (
    <div
      onMouseOver={(e) => set(e.currentTarget, (e.target as HTMLElement).closest("[data-team]")?.getAttribute("data-team") ?? null)}
      onMouseLeave={(e) => set(e.currentTarget, null)}
    >
      {children}
    </div>
  );
}
