"use client";

import { useEffect } from "react";

export interface LiveLine {
  /** « PAR–MIN » */
  label: string;
  /** « 2–1 » */
  score: string;
}

const PREFIX = /^● [^·]+ · /;

/** L'icône du site avec une pastille rouge, dessinée une fois. */
let dotted: Promise<string | null> | null = null;
function dottedIcon(): Promise<string | null> {
  dotted ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, 64, 64);
      ctx.beginPath();
      ctx.arc(49, 15, 13, 0, Math.PI * 2);
      ctx.fillStyle = "#07090d";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(49, 15, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#ff3b5c";
      ctx.fill();
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = "/icons/icon-192.png";
  });
  return dotted;
}

/**
 * Pendant le direct d'une de mes équipes, l'onglet le dit : une pastille rouge sur l'icône et le
 * score dans le titre (« ● 2–1 PAR–MIN · Clutch »). Le fond du site s'emballe aussi (`html[data-live]`).
 * Rien ne sonne et rien n'est envoyé : ce n'est pas une notification.
 */
export function LiveSignal({ matches }: { matches: LiveLine[] }) {
  const live = matches[0];
  const text = live ? `● ${live.score} ${live.label}${matches.length > 1 ? ` +${matches.length - 1}` : ""} · ` : "";

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-live", Boolean(live));
    let icon: string | null = null;
    let cancelled = false;

    // Le routeur réécrit le titre et peut ajouter les icônes de la page après coup : on repasse derrière lui.
    const apply = () => {
      const next = text + document.title.replace(PREFIX, "");
      if (document.title !== next) document.title = next;
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
        link.dataset.original ??= link.getAttribute("href") ?? "";
        link.dataset.type ??= link.type;
        const want = live && icon ? icon : link.dataset.original;
        if (want && link.getAttribute("href") !== want) {
          link.type = live && icon ? "image/png" : link.dataset.type;
          link.href = want;
        }
      }
    };
    apply();
    if (live) {
      dottedIcon().then((url) => {
        if (cancelled) return;
        icon = url;
        apply();
      });
    }
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelled = true;
      mo.disconnect();
    };
  }, [text, live]);

  return null;
}
