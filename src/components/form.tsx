import type { Form, Outcome } from "@/lib/derive";
import { cn } from "./ui";

const CHIP: Record<Outcome, { letter: string; cls: string; label: string }> = {
  win: { letter: "V", cls: "bg-win/15 text-win", label: "victoire" },
  loss: { letter: "D", cls: "bg-loss/15 text-loss", label: "défaite" },
  draw: { letter: "N", cls: "bg-panel-2 text-dim", label: "nul" },
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Les derniers résultats en pastilles, du plus récent (à gauche) au plus ancien. */
export function FormChips({ form, size = "md" }: { form: Form; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex gap-1" aria-label={form.last.map((r) => CHIP[r].label).join(", ")}>
      {form.last.map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid place-items-center rounded font-display font-bold",
            size === "sm" ? "size-5 text-[11px]" : "size-6 text-xs",
            CHIP[r].cls,
            i > 0 && "opacity-80",
          )}
        >
          {CHIP[r].letter}
        </span>
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
            {plural(streak.count, CHIP[streak.result].label)} de suite
          </span>
        </>
      )}
    </span>
  );
}
