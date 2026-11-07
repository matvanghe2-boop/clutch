import type { TeamRef } from "@/lib/types";
import { Logo } from "./ui";

/** Le contenu du tableau collé d'un match : les deux équipes, et l'enjeu entre elles. */
export function MatchDock({ us, them, mid }: { us: TeamRef | null; them: TeamRef | null; mid: React.ReactNode }) {
  return (
    <>
      <span className="dock-side">
        <Logo team={us} size={26} />
        <span className="display truncate text-base sm:text-lg">{us?.short ?? us?.name}</span>
      </span>
      <span className="dock-mid score shrink-0 text-2xl">{mid}</span>
      <span className="dock-side">
        <Logo team={them} size={26} />
        <span className="display truncate text-base sm:text-lg">{them?.short ?? them?.name ?? "À déterminer"}</span>
      </span>
    </>
  );
}
