"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { pipScore } from "@/lib/pip";

export interface ToastSide {
  name: string;
  logo?: string;
}

export interface LiveItem {
  id: string;
  href: string;
  us: ToastSide;
  them: ToastSide;
  usScore: number;
  themScore: number;
  color?: string;
}

export interface DoneItem {
  /** L'identifiant du match quand on le connaît : la fenêtre flottante s'en sert. */
  id: string;
  href?: string;
  us: ToastSide;
  them: ToastSide;
  score: string;
  result: "win" | "loss" | "draw";
  color?: string;
}

interface Toast {
  key: string;
  href?: string;
  kicker: string;
  line: string;
  us: ToastSide;
  them: ToastSide;
  score: string;
  tone: "live" | "win" | "loss" | "neutral";
  color?: string;
}

const STORE = "clutch:scores";
const SHOW_MS = 7000;

/**
 * Le score te suit : pendant un match de mes équipes, un bandeau descend en haut de l'écran quand
 * le score bouge, quand le match commence et quand il se termine, sur n'importe quelle page du
 * site (la page se met à jour seule chaque minute, voir LiveRefresher). Rien n'est envoyé au
 * téléphone : ça ne vit que dans le site ouvert. Le premier affichage de la session ne fait que
 * mémoriser les scores, sans bandeau.
 */
export function ScoreToast({ live, done }: { live: LiveItem[]; done: DoneItem[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const path = usePathname();
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    for (const m of live) pipScore(m.id, `${m.usScore} – ${m.themScore}`, "live");
    for (const d of done) pipScore(d.id, d.score.replace("–", " – "), "done", d.result === "win" ? "Victoire" : d.result === "loss" ? "Défaite" : "Terminé");

    let seen: { live: Record<string, string>; done: string[] } | null = null;
    try {
      seen = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
    } catch {}
    const next = { live: Object.fromEntries(live.map((m) => [m.id, `${m.usScore}-${m.themScore}`])), done: [...new Set([...(seen?.done ?? []), ...done.map((d) => d.id)])].slice(-40) };
    try {
      sessionStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
    if (!seen) return;

    const fresh: Toast[] = [];
    for (const m of live) {
      const before = seen.live[m.id];
      const score = `${m.usScore} – ${m.themScore}`;
      // On regarde déjà ce match : sa page montre le score en grand.
      if (path === m.href) continue;
      if (before === undefined) {
        fresh.push({ key: `${m.id}:start`, href: m.href, kicker: "C'est parti", line: `${m.us.name} contre ${m.them.name}`, us: m.us, them: m.them, score, tone: "live", color: m.color });
        continue;
      }
      const [a, b] = before.split("-").map(Number);
      if (a === m.usScore && b === m.themScore) continue;
      const line =
        m.usScore > a && m.themScore === b
          ? `${m.us.name} prend la manche`
          : m.themScore > b && m.usScore === a
            ? `${m.them.name} prend la manche`
            : "Le score a changé";
      fresh.push({ key: `${m.id}:${m.usScore}-${m.themScore}`, href: m.href, kicker: "En direct", line, us: m.us, them: m.them, score, tone: "live", color: m.color });
    }
    for (const d of done) {
      if (seen.done.includes(d.id) || (d.href && path === d.href)) continue;
      fresh.push({
        key: `${d.id}:fin`,
        href: d.href,
        kicker: d.result === "win" ? "Victoire" : d.result === "loss" ? "Défaite" : "Match nul",
        line: `${d.us.name} contre ${d.them.name}`,
        us: d.us,
        them: d.them,
        score: d.score.replace("–", " – "),
        tone: d.result === "win" ? "win" : d.result === "loss" ? "loss" : "neutral",
        color: d.color,
      });
    }
    if (!fresh.length) return;
    setToasts((list) => [...fresh, ...list.filter((t) => !fresh.some((f) => f.key === t.key))].slice(0, 3));
    for (const t of fresh) {
      window.clearTimeout(timers.current.get(t.key));
      timers.current.set(
        t.key,
        window.setTimeout(() => setToasts((list) => list.filter((x) => x.key !== t.key)), SHOW_MS),
      );
    }
    // Les scores changent à chaque mise à jour de la page : c'est elle qui déclenche la comparaison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(live), JSON.stringify(done)]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const body = (
          <>
            <span className="toast-kicker display">{t.kicker}</span>
            <span className="toast-duel">
              {t.us.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- logo de Liquipedia, sans proxy
                <img src={t.us.logo} alt="" referrerPolicy="no-referrer" />
              )}
              <b className="score">{t.score}</b>
              {t.them.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- logo de Liquipedia, sans proxy
                <img src={t.them.logo} alt="" referrerPolicy="no-referrer" />
              )}
            </span>
            <span className="toast-line">{t.line}</span>
          </>
        );
        return (
          <div key={t.key} className="toast" data-tone={t.tone} style={t.color ? ({ "--accent": t.color } as React.CSSProperties) : undefined}>
            {t.href ? (
              <Link href={t.href} className="toast-body" onClick={() => setToasts((list) => list.filter((x) => x.key !== t.key))}>
                {body}
              </Link>
            ) : (
              <div className="toast-body">{body}</div>
            )}
            <button type="button" className="toast-close" aria-label="Fermer" onClick={() => setToasts((list) => list.filter((x) => x.key !== t.key))}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
