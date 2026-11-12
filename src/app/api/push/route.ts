import { isAdmin } from "@/lib/admin";
import { pushReady } from "@/lib/push/send";
import { DEFAULT_PREFS, loadSubs, type PushPrefs, saveSubs, subId } from "@/lib/push/store";

/**
 * L'abonnement aux notifications d'un appareil : s'abonner ou changer ce qu'on reçoit (POST),
 * se désabonner (DELETE). Réservé au navigateur déverrouillé avec le code des réglages : le site
 * est public, et les notifications ne concernent que l'utilisateur.
 */
export const dynamic = "force-dynamic";

interface Body {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  prefs?: Partial<PushPrefs>;
  device?: string;
}

const bad = (message: string, status = 400) => Response.json({ ok: false, message }, { status });

export async function POST(request: Request) {
  if (!(await isAdmin())) return bad("Déverrouille d'abord les réglages avec ton code.", 403);
  if (!pushReady()) return bad("La clé VAPID_PRIVATE_KEY manque sur le serveur : ajoute-la dans Vercel, puis redéploie.", 503);
  const body = (await request.json().catch(() => ({}))) as Body;
  const s = body.subscription;
  if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys.auth) return bad("Abonnement invalide.");
  const subs = await loadSubs();
  const id = subId(s.endpoint);
  const prefs: PushPrefs = { ...DEFAULT_PREFS, ...subs[id]?.prefs };
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof PushPrefs)[]) if (typeof body.prefs?.[k] === "boolean") prefs[k] = body.prefs[k]!;
  subs[id] = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, prefs, device: body.device?.slice(0, 40), at: new Date().toISOString() };
  await saveSubs(subs);
  return Response.json({ ok: true, prefs, devices: Object.keys(subs).length });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return bad("Déverrouille d'abord les réglages avec ton code.", 403);
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return bad("Adresse d'abonnement manquante.");
  const subs = await loadSubs();
  delete subs[subId(endpoint)];
  await saveSubs(subs);
  return Response.json({ ok: true });
}

/** L'état de cet appareil (ses choix), et si le serveur peut envoyer. */
export async function PUT(request: Request) {
  if (!(await isAdmin())) return bad("Déverrouille d'abord les réglages avec ton code.", 403);
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const subs = await loadSubs();
  const sub = endpoint ? subs[subId(endpoint)] : undefined;
  return Response.json({ ok: true, ready: pushReady(), known: Boolean(sub), prefs: sub?.prefs ?? DEFAULT_PREFS });
}
