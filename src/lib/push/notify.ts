/**
 * Après chaque passe de la synchro régulière (toutes les 5 minutes) : les événements nouveaux
 * partent vers chaque appareil abonné qui les a choisis, puis sont notés au journal.
 */
import type { Snapshot } from "../types";
import { pruneSent, pushEvents } from "./events";
import { pushReady, sendPush } from "./send";
import { loadSent, loadSubs, saveSent, saveSubs } from "./store";

export async function notifyFromSnapshot(snap: Snapshot, now = Date.now() / 1000): Promise<string> {
  if (!pushReady()) return "pas de clé VAPID";
  const [subs, journal] = await Promise.all([loadSubs(), loadSent()]);
  const events = pushEvents(snap, now, journal);
  const at = new Date(now * 1000).toISOString();
  const sent = pruneSent(journal, now);
  // La toute première fois, on note sans rien envoyer : pas de rafale de vieux résultats.
  const first = !journal.__init;
  sent.__init = { at };
  let delivered = 0;
  let removed = 0;
  if (!first) {
    for (const e of events) {
      for (const [id, sub] of Object.entries(subs)) {
        if (!sub.prefs[e.kind]) continue;
        const outcome = await sendPush(sub, e.payload);
        if (outcome === "sent") delivered++;
        if (outcome === "gone") {
          delete subs[id];
          removed++;
        }
      }
    }
  }
  for (const e of events) sent[e.key] = { at, value: e.value };
  if (events.length || first) await saveSent(sent);
  if (removed) await saveSubs(subs);
  return first ? `journal amorcé (${events.length} événements notés)` : `${events.length} événements, ${delivered} notifications${removed ? `, ${removed} abonnements oubliés` : ""}`;
}
