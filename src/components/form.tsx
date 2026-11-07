import { Fragment } from "react";
import type { Form, Outcome } from "@/lib/derive";
import { cn } from "./ui";

const CHIP: Record<Outcome, { letter: string; cls: string; label: string }> = {
  win: { letter: "V", cls: "bg-win/15 text-win", label: "victoire" },
  loss: { letter: "D", cls: "bg-loss/15 text-loss", label: "défaite" },
  draw: { letter: "N", cls: "bg-panel-2 text-dim", label: "nul" },
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

const HOT_STREAK = 5;

const Flame = () => (
  <svg viewBox="0 0 24 24" className="flame" aria-hidden>
    <path d="M12 2c1 4-3 5.5-3 9a3 3 0 0 0 1.4 2.5C10 11.5 11.5 10 12.5 9c.3 2.5 3.5 3.6 3.5 7a4 4 0 0 1-8 0c0-.4 0-.8.1-1.2C6.800 14 6 12.700 6 11c0-4 5-5.500 6-9Z" fill="currentColor" />
  </svg>
);

/**
 * Les derniers résultats en pastilles, du plus récent (à gauche) au plus ancien.
 * `current` : combien sont de l'effectif actuel. Un trait les sépare des autres,
 * joués par une équipe qui n'existe plus.
 */
export function FormChips({ form, size = "md", current }: { form: Form; size?: "sm" | "md"; current?: number }) {
  const split = current !== undefined && current < form.last.length ? current : undefined;
  // Cinq victoires de suite ou plus : la série s'enflamme.
  const hot = form.streak?.result === "win" && form.streak.count >= HOT_STREAK ? form.streak.count : 0;
  return (
    <span className="chips inline-flex flex-wrap items-center gap-1" aria-label={form.last.map((r) => CHIP[r].label).join(", ")}>
      {form.last.map((r, i) => (
        <Fragment key={i}>
          {i === split && <span className="mx-0.5 h-4 w-px bg-faint" title="À gauche : l'effectif actuel. À droite : l'effectif d'avant." />}
          <span
            className={cn(
              "grid place-items-center rounded font-display font-extrabold italic",
              size === "sm" ? "size-5 text-[11px]" : "size-6 text-xs",
              CHIP[r].cls,
              i > 0 && i >= hot && "opacity-80",
              split !== undefined && i >= split && "opacity-40",
              i < hot && "chip-hot",
            )}
          >
            {CHIP[r].letter}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Bilan et série en cours, en une ligne. */
export function FormSummary({ form }: { form: Form }) {
  if (!form.last.length) return null;
  const { streak } = form;
  return (
    <span className="text-xs text-faint">
      {form.wins} V – {form.losses} D{form.draws ? ` – ${form.draws} N` : ""} sur {form.last.length}
      {streak && streak.count > 1 && (
        <>
          {" · "}
          <span className={streak.result === "win" ? "text-win" : streak.result === "loss" ? "text-loss" : "text-dim"}>
            {streak.result === "win" && streak.count >= HOT_STREAK && <Flame />}
            {plural(streak.count, CHIP[streak.result].label)} de suite
          </span>
        </>
      )}
    </span>
  );
}
