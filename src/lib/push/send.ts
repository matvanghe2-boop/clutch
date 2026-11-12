/**
 * L'envoi d'une notification à un téléphone ou un ordinateur abonné (Web Push, clés VAPID). Le
 * service de notification de l'appareil (Google, Apple, Mozilla) la remet même appli fermée.
 */
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/config/push";
import type { PushSub } from "./store";

/** Ce que reçoit le service worker (public/sw.js). */
export interface PushPayload {
  title: string;
  body: string;
  /** La page à ouvrir au toucher. */
  url: string;
  /** Une notification de même étiquette remplace la précédente (le score d'un même match). */
  tag?: string;
}
// Pas de logo d'équipe : l'appareil irait le chercher chez Liquipedia avec l'adresse de Clutch en
// Referer, et recevrait l'image de refus (voir lib/motion/hotlink.ts). L'icône de Clutch suffit.

export const pushReady = () => Boolean(process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured) return;
  const key = process.env.VAPID_PRIVATE_KEY;
  if (!key) throw new Error("VAPID_PRIVATE_KEY manque : les notifications ne peuvent pas partir.");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, key);
  configured = true;
}

/** « gone » : l'abonnement n'existe plus (appli désinstallée, notifications coupées) et peut être oublié. */
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<"sent" | "gone" | "failed"> {
  configure();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
      // Un rappel ou un score ne vaut plus rien au bout d'une heure : le service ne le garde pas plus.
      TTL: 3600,
      urgency: "high",
    });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[clutch] notification :", status, (e as Error).message);
    return "failed";
  }
}
