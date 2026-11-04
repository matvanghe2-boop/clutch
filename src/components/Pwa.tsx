"use client";

import { useEffect, useState } from "react";

/** Événement de Chrome, Edge et Android ; absent des types du DOM. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Enregistre le service worker (en production : en développement, il
 * servirait des fichiers périmés) et propose d'installer l'appli quand le
 * navigateur le permet. Sur iPhone, l'installation passe par
 * Partager → « Sur l'écran d'accueil » : aucun bouton possible.
 */
export function InstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
      }}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-dim transition-colors hover:border-faint hover:text-ink"
    >
      Installer
    </button>
  );
}
