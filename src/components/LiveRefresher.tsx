"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mode « match en cours » : tant qu'un match d'une équipe suivie est en cours
 * ou imminent, la page se recharge toute seule chaque minute. Côté serveur,
 * chaque rechargement peut relancer la lecture de la page de l'équipe (toutes
 * les 4 minutes au plus).
 */
export function LiveRefresher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
