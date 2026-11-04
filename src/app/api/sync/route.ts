import { emptySnapshot } from "@/lib/snapshot";
import { autoRefresh } from "@/lib/sync/auto";
import { readPublished } from "@/lib/sync/publish";

/**
 * Appelée une fois par jour par le cron de Vercel (vercel.json ; le plan Hobby
 * n'en autorise pas davantage) : une passe de synchro même si personne n'ouvre
 * le site et que la synchro planifiée de GitHub est arrêtée. Vercel envoie le
 * jeton CRON_SECRET s'il est défini ; sans lui, le verrou de la synchro limite
 * de toute façon les passes à une toutes les dix minutes.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  const snap = (await readPublished()) ?? emptySnapshot();
  await autoRefresh(snap, { always: true });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
