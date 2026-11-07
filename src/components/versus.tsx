import Link from "next/link";
import type { TeamRef } from "@/lib/types";
import { cn, Logo } from "./ui";

/** Un logo flou, derrière la scène : chaque équipe l'éclaire de ses propres couleurs. */
function Backlight({ team, side }: { team: TeamRef | null; side: "left" | "right" }) {
  if (!team?.logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- décor : le logo de Liquipedia, sans proxy
    <img src={team.logo} alt="" aria-hidden referrerPolicy="no-referrer" className="backlight" style={side === "left" ? { left: "-6%" } : { right: "-6%" }} />
  );
}

function Fighter({ team, href, side, dim }: { team: TeamRef | null; href?: string; side: "left" | "right"; dim?: boolean }) {
  const name = team?.name ?? "À déterminer";
  return (
    <div className={cn(side === "left" ? "arena-left" : "arena-right", "flex min-w-0 flex-col items-center gap-3 text-center transition-opacity", dim && "opacity-55")}>
      <span className="arena-logo">
        <Logo team={team} size={108} className="!size-16 sm:!size-24 lg:!size-28" />
      </span>
      <div className="w-full min-w-0">
        <div className="display line-clamp-3 break-words text-lg sm:text-2xl lg:text-4xl">
          {href ? (
            <Link href={href} className="transition-colors hover:text-[var(--accent)]">
              {name}
            </Link>
          ) : (
            name
          )}
        </div>
        {team?.short && team.short !== name && <div className="mt-1 text-xs tracking-[0.2em] text-faint">{team.short}</div>}
      </div>
    </div>
  );
}

/**
 * La scène d'un match, sur l'accueil comme sur sa feuille : les deux équipes se font
 * face, éclairées par leurs couleurs, et l'enjeu (heure ou score) au centre.
 */
export function Versus({
  us,
  them,
  usHref,
  themHref,
  top,
  center,
  bottom,
  live,
  game,
  dimUs,
  dimThem,
}: {
  us: TeamRef | null;
  them: TeamRef | null;
  usHref?: string;
  themHref?: string;
  top: React.ReactNode;
  center: React.ReactNode;
  bottom?: React.ReactNode;
  live?: boolean;
  game: string;
  dimUs?: boolean;
  dimThem?: boolean;
}) {
  return (
    <section data-game={game} className={cn("arena", live && "live-ring")}>
      <Backlight team={us} side="left" />
      <Backlight team={them} side="right" />
      <span className="slash" aria-hidden />
      <div className="relative p-4 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-xs">{top}</div>
        <div className="mt-6 grid grid-cols-2 items-center gap-x-3 gap-y-5 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6">
          <Fighter team={us} href={usHref} side="left" dim={dimUs} />
          <div className="arena-center col-span-2 row-start-2 text-center sm:col-span-1 sm:row-start-auto">{center}</div>
          <Fighter team={them} href={themHref} side="right" dim={dimThem} />
        </div>
        {bottom && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm sm:mt-8">{bottom}</div>}
      </div>
    </section>
  );
}

/** Le décor d'une page d'équipe : son logo en filigrane, et sa lumière. */
export function TeamHero({ team, game, children }: { team: TeamRef; game: string; children: React.ReactNode }) {
  return (
    <section data-game={game} className="arena">
      {team.logo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- décor : le logo de Liquipedia, sans proxy */}
          <img src={team.logo} alt="" aria-hidden referrerPolicy="no-referrer" className="backlight" style={{ left: "-8%", width: "60%" }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- filigrane */}
          <img
            src={team.logo}
            alt=""
            aria-hidden
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute -right-10 top-1/2 -z-10 size-72 -translate-y-1/2 -rotate-12 object-contain opacity-[0.07] sm:size-96"
          />
        </>
      )}
      <div className="arena-left relative flex items-center gap-4 p-5 sm:gap-7 sm:p-8">
        <span className="arena-logo shrink-0">
          <Logo team={team} size={112} className="!size-20 sm:!size-28" />
        </span>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
