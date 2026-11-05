import { GAMES } from "@/config/follow";
import type { GameId, Stream, TeamRef } from "@/lib/types";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Logo({ team, size = 28, className }: { team: TeamRef | null; size?: number; className?: string }) {
  if (team?.logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos servis par Liquipedia, sans proxy
      <img
        src={team.logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  const initials = (team?.short ?? team?.name ?? "?").slice(0, 3).toUpperCase();
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-md bg-panel-2 font-display font-bold text-faint", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.34) }}
    >
      {initials}
    </span>
  );
}

export function GameTag({ game, long }: { game: GameId; long?: boolean }) {
  return (
    <span
      data-game={game}
      className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-display text-[11px] font-bold tracking-wider text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
    >
      {long ? GAMES[game].label : GAMES[game].short}
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-display text-xs font-bold tracking-widest text-live", className)}>
      <span className="live-dot size-1.5 rounded-full bg-live" />
      LIVE
    </span>
  );
}

export function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const map = {
    win: ["V", "text-win bg-win/12"],
    loss: ["D", "text-loss bg-loss/12"],
    draw: ["N", "text-dim bg-panel-2"],
  } as const;
  const [label, cls] = map[result];
  return (
    <span className={cn("grid size-6 place-items-center rounded font-display text-sm font-bold", cls)} title={result}>
      {label}
    </span>
  );
}

const TwitchIcon = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
    <path d="M4.3 3 3 6.4V20h4.6v2.5h2.6l2.5-2.5h3.7l5-5V3H4.3Zm15.4 11.2-2.9 2.9h-4.6l-2.5 2.5v-2.5H5.8V4.7h13.9v9.5ZM16.8 8v5h-1.7V8h1.7Zm-4.6 0v5h-1.7V8h1.7Z" />
  </svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
    <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-4.8.5-4.8s0-3.2-.5-4.8ZM9.8 15V9l5.7 3-5.7 3Z" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7L8 5Z" />
  </svg>
);

const PLATFORM: Record<string, { label: string; icon: () => React.JSX.Element; hover: string }> = {
  twitch: { label: "Twitch", icon: TwitchIcon, hover: "hover:text-[#b48cff] hover:border-[#9146ff]/60" },
  youtube: { label: "YouTube", icon: YoutubeIcon, hover: "hover:text-[#ff6b6b] hover:border-[#ff0000]/50" },
};

export function StreamLinks({ streams, compact, max = 3 }: { streams: Stream[]; compact?: boolean; max?: number }) {
  if (!streams.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {streams.slice(0, max).map((s) => {
        const p = PLATFORM[s.platform] ?? { label: s.platform, icon: PlayIcon, hover: "hover:text-ink" };
        const Icon = p.icon;
        return (
          <a
            key={`${s.platform}/${s.channel}`}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${p.label} · ${s.channel}${s.fr ? " (en français)" : ""}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 text-xs text-dim transition-colors",
              compact ? "p-1.5" : "px-2.5 py-1.5",
              p.hover,
            )}
          >
            <Icon />
            {s.fr && <span className="text-[10px] font-bold tracking-wide text-[var(--accent)]">FR</span>}
            {!compact && <span>{s.channel}</span>}
          </a>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-dim">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">{children}</div>
  );
}
