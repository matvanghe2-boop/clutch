"use client";

import { useActionState, useState } from "react";
import { predictScore } from "@/app/actions";
import { cn, Num } from "./ui";

const MESSAGES: Record<string, string> = {
  verrouille: "Déverrouille d'abord les réglages avec ton code pour pronostiquer.",
  commence: "Trop tard : le match a commencé.",
  invalide: "Ce score n'est pas possible dans ce format.",
  introuvable: "Ce match n'est plus connu du site.",
};

/**
 * Le choix d'un score : les chiffres roulent jusqu'au score touché, et « Valider » l'enregistre sans
 * quitter la page, avec un tampon. Le score voyage dans un champ caché.
 */
export function ScorePicker({ id, scores, initial, usName, themName }: { id: string; scores: [number, number][]; initial?: [number, number]; usName: string; themName: string }) {
  const [score, setScore] = useState<[number, number]>(initial ?? scores[0]);
  const [result, save, saving] = useActionState(predictScore, {});
  const same = initial && initial[0] === score[0] && initial[1] === score[1];
  const problem = result.status && result.status !== "enregistre" ? MESSAGES[result.status] : undefined;
  return (
    <form action={save} className="space-y-4">
      {result.status === "enregistre" && (
        // La clé change à chaque enregistrement : le tampon se rejoue.
        <span key={result.at} className="prono-stamp display" aria-live="polite">
          Validé
        </span>
      )}
      {problem && <p className="text-sm text-loss">{problem}</p>}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="score" value={`${score[0]}-${score[1]}`} />
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <span className="min-w-0 flex-1 truncate text-right text-sm text-dim">{usName}</span>
        <span className="score picker-figure">
          <Num value={score[0]} />
          <span className="px-2 text-faint">–</span>
          <Num value={score[1]} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-dim">{themName}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {scores.map(([a, b]) => {
          const picked = score[0] === a && score[1] === b;
          return (
            <button
              key={`${a}-${b}`}
              type="button"
              onClick={() => setScore([a, b])}
              aria-pressed={picked}
              title={a > b ? `Victoire de ${usName}` : a < b ? `Victoire de ${themName}` : "Match nul"}
              className={cn(
                "rounded-lg border px-3 py-1.5 font-display text-base font-semibold tabular-nums transition-colors",
                picked ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : a > b ? "border-line text-ink hover:border-win/60" : a < b ? "border-line text-dim hover:border-loss/60" : "border-line text-dim hover:border-faint",
              )}
            >
              {a}–{b}
            </button>
          );
        })}
        <button className="ml-1 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-black transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100" disabled={same || saving}>
          {saving ? "…" : same ? "Enregistré" : "Valider"}
        </button>
      </div>
    </form>
  );
}
