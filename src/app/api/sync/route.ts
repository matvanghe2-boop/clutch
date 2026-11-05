import { after } from "next/server";
import { emptySnapshot } from "@/lib/snapshot";
import { autoRefresh, scheduledPass } from "@/lib/sync/auto";
import { readPublished } from "@/lib/sync/publish";

/**
 * Point d'entrée de la synchro régulière.
 *
 * Avec CRON_SECRET : un cron externe (cron-job.org) l'appelle toutes les
 * 5 minutes avec l'en-tête « Authorization: Bearer <secret> », comme le cron
 * quotidien de Vercel (vercel.json), qui l'envoie de lui-même. La réponse part
 * aussitôt et la passe continue ensuite : le cron n'attend pas Liquipedia
 * (cron-job.org abandonne au bout de 30 s).
 *
 * Sans CRON_SECRET : seulement une passe de secours, sous verrou. Ouverte à
 * tous, elle ne doit pas permettre de doubler le rythme des appels.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });
    after(() => scheduledPass().catch((e) => console.error("[clutch] synchro régulière :", e)));
    return Response.json({ ok: true, mode: "planifiée", at: new Date().toISOString() });
  }
  const snap = (await readPublished()) ?? emptySnapshot();
  after(() => autoRefresh(snap, { always: true }).catch((e) => console.error("[clutch] passe de secours :", e)));
  return Response.json({ ok: true, mode: "secours", at: new Date().toISOString() });
}
