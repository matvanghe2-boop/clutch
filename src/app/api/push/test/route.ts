import { isAdmin } from "@/lib/admin";
import { pushReady, sendPush } from "@/lib/push/send";
import { loadSubs, saveSubs, subId } from "@/lib/push/store";

/** Une notification d'essai vers cet appareil : de quoi vérifier que tout le chemin fonctionne. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ ok: false, message: "Déverrouille d'abord les réglages avec ton code." }, { status: 403 });
  if (!pushReady()) return Response.json({ ok: false, message: "La clé VAPID_PRIVATE_KEY manque sur le serveur." }, { status: 503 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const subs = await loadSubs();
  const id = endpoint ? subId(endpoint) : "";
  const sub = subs[id];
  if (!sub) return Response.json({ ok: false, message: "Cet appareil n'est pas abonné." }, { status: 404 });
  const outcome = await sendPush(sub, {
    title: "Clutch : ça marche",
    body: "Tu recevras ici les rappels, les scores et les résultats de tes équipes.",
    url: "/reglages",
    tag: "essai",
  });
  if (outcome === "gone") {
    delete subs[id];
    await saveSubs(subs);
  }
  return Response.json({ ok: outcome === "sent", message: outcome === "sent" ? "Envoyée." : outcome === "gone" ? "Abonnement expiré : réactive les notifications." : "L'envoi a échoué." });
}
