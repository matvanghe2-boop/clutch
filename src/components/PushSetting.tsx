"use client";

import { useCallback, useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/config/push";

type Prefs = { before: boolean; score: boolean; result: boolean; schedule: boolean };
type State = "checking" | "locked" | "install-first" | "unsupported" | "no-sw" | "denied" | "off" | "on";

const CHOICES: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: "before", label: "Avant le match", detail: "un quart d'heure avant le début" },
  { key: "score", label: "Chaque manche", detail: "pendant le direct" },
  { key: "result", label: "Le résultat", detail: "victoire ou défaite, à la fin" },
  { key: "schedule", label: "Heure changée", detail: "quand Liquipedia déplace un match" },
];

/** La clé publique au format qu'attend le navigateur. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const deviceName = () => {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Appareil";
};

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Première visite : le service worker s'installe juste après l'affichage.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

/**
 * Les notifications sur ce téléphone (ou cet ordinateur) : rappels avant les matchs, manches du
 * direct, résultats, heures changées. Elles arrivent même appli fermée. Sur iPhone, il faut d'abord
 * installer l'appli sur l'écran d'accueil (iOS 16.4 ou plus) et l'ouvrir depuis son icône.
 */
export function PushSetting({ admin }: { admin: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [prefs, setPrefs] = useState<Prefs>({ before: true, score: true, result: true, schedule: true });
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);

  const save = useCallback(async (subscription: PushSubscription, next: Prefs) => {
    const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON(), prefs: next, device: deviceName() }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; prefs?: Prefs };
    if (!json.ok) throw new Error(json.message ?? "Le serveur a refusé l'abonnement.");
    if (json.prefs) setPrefs(json.prefs);
  }, []);

  useEffect(() => {
    (async () => {
      if (!admin) return setState("locked");
      if (isIos() && !isInstalled()) return setState("install-first");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await registration();
      if (!reg) return setState("no-sw");
      const current = await reg.pushManager.getSubscription();
      if (!current) return setState("off");
      setSub(current);
      const res = await fetch("/api/push", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
      const json = (await res.json().catch(() => ({}))) as { known?: boolean; prefs?: Prefs };
      if (json.prefs) setPrefs(json.prefs);
      // Abonné côté appareil mais inconnu du serveur (base vidée, autre déploiement) : on le redonne.
      if (!json.known) await save(current, json.prefs ?? prefs).catch(() => undefined);
      setState("on");
    })().catch(() => setState("unsupported"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule vérification à l'ouverture
  }, [admin]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      if (!reg) return setState("no-sw");
      const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
      await save(subscription, prefs);
      setSub(subscription);
      setState("on");
      setMessage({ text: "Notifications activées sur cet appareil.", ok: true });
    } catch (e) {
      setMessage({ text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!sub) return;
    setBusy(true);
    try {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
      setSub(null);
      setState("off");
      setMessage({ text: "Plus aucune notification sur cet appareil.", ok: true });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: keyof Prefs) => {
    if (!sub) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await save(sub, next).catch((e) => setMessage({ text: (e as Error).message }));
  };

  const test = async () => {
    if (!sub) return;
    setBusy(true);
    const res = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setMessage({ text: json.ok ? "Notification d'essai envoyée : elle arrive dans quelques secondes." : (json.message ?? "L'envoi a échoué."), ok: json.ok });
    setBusy(false);
  };

  const note: Partial<Record<State, string>> = {
    checking: "Vérification…",
    locked: "Déverrouille d'abord les réglages avec ton code (plus haut) : les notifications sont réservées à ton appareil.",
    "install-first": "Sur iPhone, les notifications passent par l'appli installée : dans Safari, Partager → « Sur l'écran d'accueil », puis ouvre Clutch depuis son icône et reviens ici (iOS 16.4 ou plus).",
    unsupported: "Ce navigateur ne reçoit pas les notifications web.",
    "no-sw": "Le site n'est pas encore prêt à recevoir des notifications : recharge la page, puis réessaie (seulement sur le site en ligne).",
    denied: "Les notifications sont bloquées pour Clutch. Autorise-les dans les réglages du téléphone (ou du navigateur), puis recharge la page.",
  };

  return (
    <div className="push panel" data-state={state}>
      <div className="push-head">
        <span className="push-bell" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <b className="display block text-xl">{state === "on" ? "Activées sur cet appareil" : "Notifications"}</b>
          <span className="block text-sm text-dim">{note[state] ?? "Rappels, manches, résultats et heures changées, même appli fermée."}</span>
        </div>
        {state === "off" && (
          <button type="button" className="push-cta" onClick={enable} disabled={busy}>
            {busy ? "…" : "Activer"}
          </button>
        )}
      </div>

      {state === "on" && (
        <>
          <div className="push-choices" role="group" aria-label="Ce que tu reçois">
            {CHOICES.map((c) => (
              <button key={c.key} type="button" role="switch" aria-checked={prefs[c.key]} className="push-choice" onClick={() => toggle(c.key)}>
                <span className="push-switch" aria-hidden />
                <span className="min-w-0 text-left">
                  <b className="block text-sm">{c.label}</b>
                  <span className="block text-xs text-faint">{c.detail}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="push-cta" onClick={test} disabled={busy}>
              Envoyer une notification d&apos;essai
            </button>
            <button type="button" className="text-sm text-faint hover:text-dim" onClick={disable} disabled={busy}>
              Désactiver sur cet appareil
            </button>
          </div>
        </>
      )}
      {message && <p className={message.ok ? "text-sm text-win" : "text-sm text-loss"}>{message.text}</p>}
    </div>
  );
}
