"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { watchSections } from "@/lib/reveal";
import { cn } from "./ui";

/**
 * Lance les entrées à l'écran. Une seule surveillance pour toute la visite : elle voit arriver
 * chaque nouvelle page d'elle-même, inutile de la relancer au changement d'adresse.
 */
export function MotionRoot() {
  useEffect(() => {
    // Rassure le script de layout.tsx : les sections cachées seront bien révélées.
    document.documentElement.setAttribute("data-motion-ready", "");
    return watchSections();
  }, []);
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
