"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { cn } from "./ui";

/**
 * Déclenche les entrées à l'écran : chaque section reçoit `data-in` quand on l'atteint,
 * et globals.css fait le reste. Un attribut plutôt qu'une classe : React réécrit
 * `className`, pas ce qu'il n'a pas posé, donc un rafraîchissement du direct ne rejoue rien.
 */
export function MotionRoot() {
  const pathname = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    const scan = () => {
      for (const el of document.querySelectorAll("main section:not([data-in]):not([data-watched])")) {
        el.setAttribute("data-watched", "");
        io.observe(el);
      }
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);
  return null;
}

/** Un lien de navigation : un trait s'allume sous la page où l'on est. */
export function NavLink({ href, title, game, children }: { href: string; title?: string; game?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} title={title} data-game={game} data-active={active ? "" : undefined} className={cn("nav-link")}>
      {children}
    </Link>
  );
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
