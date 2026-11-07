"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "./ui";

/**
 * Un groupe de filtres : la pastille glisse d'un choix à l'autre, et part dès le clic sans attendre
 * que la nouvelle page arrive. Le choix actif porte `data-on`.
 */
export function Pills({ children, className, skew, label }: { children: React.ReactNode; className?: string; skew?: boolean; label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const moveTo = (el: Element | null | undefined) => {
    const t = thumb.current;
    if (!t || !(el instanceof HTMLElement)) return;
    t.style.width = `${el.offsetWidth}px`;
    t.style.height = `${el.offsetHeight}px`;
    t.style.setProperty("--x", `${el.offsetLeft}px`);
    t.style.setProperty("--y", `${el.offsetTop}px`);
    t.style.setProperty("--c", getComputedStyle(el).getPropertyValue("--accent"));
    t.style.opacity = "1";
  };
  useLayoutEffect(() => {
    const place = () => moveTo(root.current?.querySelector("[data-on]"));
    place();
    document.fonts?.ready.then(place);
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  });
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      data-ready=""
      className={cn("pills", skew && "pills-skew", className)}
      onClickCapture={(e) => {
        const link = (e.target as Element).closest("a");
        if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey) moveTo(link);
      }}
    >
      <span ref={thumb} className="pill-thumb" aria-hidden />
      {children}
    </div>
  );
}

/** Le choix « Tous les matchs / Mes matchs » d'une compétition : il garde l'onglet ouvert. */
export function OursToggle({ base, onlyOurs }: { base: string; onlyOurs: boolean }) {
  const search = useSearchParams();
  usePathname();
  const onglet = search.get("onglet");
  const href = (mine: boolean) => {
    const q = new URLSearchParams();
    if (onglet) q.set("onglet", onglet);
    if (mine) q.set("mes", "1");
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <Pills label="Matchs affichés" className="pills-round text-sm">
      {[
        { label: "Tous les matchs", mine: false },
        { label: "Mes matchs", mine: true },
      ].map((o) => (
        <Link key={o.label} href={href(o.mine)} scroll={false} data-on={o.mine === onlyOurs ? "" : undefined} className="pill">
          {o.label}
        </Link>
      ))}
    </Pills>
  );
}
