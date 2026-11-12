/**
 * Ce qui mérite une notification, d'après l'instantané : le rappel avant un match, chaque manche
 * pendant le direct, le résultat, une heure changée. Pur (pas d'envoi) : la synchro l'appelle
 * après chaque passe, et le journal `sent` dit ce qui est déjà parti.
 */
import { matchHref, type Oriented, recentFeed, statusOf, upcomingFeed } from "../derive";
import { clock, dayKey, shortDay } from "../format";
import { pairKey } from "../schedule";
import type { Snapshot } from "../types";
import type { PushPayload } from "./send";
import type { PushPrefs, PushSent } from "./store";

export interface PushEvent {
  /** Clé dans le journal : un même événement ne part qu'une fois. */
  key: string;
  /** Pour le score : la valeur envoyée, pour repérer la suivante. */
  value?: string;
  kind: keyof PushPrefs;
  /** L'équipe suivie concernée (filtre éventuel des abonnés). */
  teamId: string;
  payload: PushPayload;
}

/** Le rappel part dans le quart d'heure qui précède : la synchro passe toutes les 5 minutes. */
const BEFORE_S = 16 * 60;
/** Un résultat ou une heure changée plus anciens ne valent plus une notification. */
const FRESH_S = 6 * 3600;

const name = (o: Oriented, side: "us" | "them") => (side === "us" ? (o.us.short ?? o.us.name) : (o.them?.short ?? o.them?.name ?? "?"));

export function pushEvents(snap: Snapshot, now: number, sent: PushSent): PushEvent[] {
  const out: PushEvent[] = [];
  const upcoming = upcomingFeed(snap);

  for (const o of upcoming) {
    const m = o.match;
    const st = statusOf(m, now);
    const title = `${name(o, "us")} – ${name(o, "them")}`;
    const where = [m.tournament?.name, m.round].filter(Boolean).join(" · ");
    const url = matchHref(m);
    const tag = `match:${pairKey(o) ?? m.id}`;

    // Le rappel : seulement à heure précise, et l'adversaire connu.
    if (st === "upcoming" && o.them && m.timestamp !== undefined && !m.timeTbd && m.timestamp - now <= BEFORE_S && m.timestamp > now) {
      const key = `avant:${m.id}`;
      if (!sent[key]) {
        const min = Math.max(1, Math.round((m.timestamp - now) / 60));
        out.push({ key, kind: "before", teamId: o.team.id, payload: { title: `Dans ${min} min : ${title}`, body: `${clock(m.timestamp)}${where ? ` · ${where}` : ""}`, url, tag } });
      }
    }

    // Chaque manche du direct. La première vue (1–0, 0–1) dit aussi que le match a commencé.
    if (st === "live" && o.them) {
      const us = Number(o.usScore ?? 0);
      const them = Number(o.themScore ?? 0);
      if (us + them > 0) {
        const key = `score:${m.id}`;
        const value = `${us}-${them}`;
        const before = sent[key]?.value;
        if (before !== value) {
          const [a, b] = (before ?? "0-0").split("-").map(Number);
          const line = us > a && them === b ? `${name(o, "us")} prend la manche` : them > b && us === a ? `${name(o, "them")} prend la manche` : "Le score a changé";
          out.push({ key, value, kind: "score", teamId: o.team.id, payload: { title: `${name(o, "us")} ${us}–${them} ${name(o, "them")}`, body: `${line}${where ? ` · ${where}` : ""}`, url, tag } });
        }
      }
    }
  }

  // Le résultat, une fois le match fini.
  for (const r of recentFeed(snap)) {
    if (now - r.timestamp > FRESH_S || r.timestamp > now) continue;
    const key = `fin:${r.team.id}:${r.timestamp}`;
    if (sent[key]) continue;
    const them = r.opponent?.short ?? r.opponent?.name ?? "?";
    const verdict = r.result === "win" ? "Victoire" : r.result === "loss" ? "Défaite" : "Match nul";
    out.push({
      key,
      kind: "result",
      teamId: r.team.id,
      payload: {
        title: `${verdict} ${r.usScore}–${r.themScore} contre ${them}`,
        body: `${r.team.page}${r.tournament?.name ? ` · ${r.tournament.name}` : ""}`,
        url: r.matchId ? `/match/${encodeURIComponent(r.matchId)}` : "/",
        tag: `fin:${r.team.id}:${r.timestamp}`,
      },
    });
  }

  // Une heure changée par Liquipedia (voir lib/schedule.ts).
  for (const o of upcoming) {
    const key0 = pairKey(o);
    const move = key0 ? snap.moves?.[key0] : undefined;
    if (!move || o.match.timestamp === undefined || Math.abs(move.to - o.match.timestamp) > 60) continue;
    if (now - Date.parse(move.at) / 1000 > FRESH_S || move.to < now) continue;
    const key = `horaire:${key0}:${move.to}`;
    if (sent[key]) continue;
    const day = dayKey(move.from) === dayKey(move.to) ? "" : `${shortDay(move.to, now)} `;
    out.push({
      key,
      kind: "schedule",
      teamId: o.team.id,
      payload: { title: `Heure changée : ${name(o, "us")} – ${name(o, "them")}`, body: `${day}${clock(move.to)} au lieu de ${clock(move.from)}`, url: matchHref(o.match), tag: `match:${key0}` },
    });
  }

  return out;
}

/** Le journal sans ce qui a plus de trois jours. */
export function pruneSent(sent: PushSent, now: number): PushSent {
  return Object.fromEntries(Object.entries(sent).filter(([, v]) => now - Date.parse(v.at) / 1000 < 3 * 86400));
}
