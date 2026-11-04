import Link from "next/link";
import { FOLLOWED, GAMES } from "@/config/follow";
import { clock, dayKey, relative, shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { InstallButton } from "./Pwa";
import { Logo } from "./ui";

export async function SiteHeader() {
  const snap = await loadSnapshot();
  return (
    // Installée sur iPhone, l'appli s'étend sous la barre d'état : l'en-tête la laisse libre.
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <Mark className="size-7 transition-transform group-hover:-rotate-6" />
          <span className="font-display text-xl font-bold tracking-[0.14em]">CLUTCH</span>
        </Link>
        <nav className="scrollbar-thin -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          <Link
            href="/calendrier"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-dim transition-colors hover:bg-panel-2 hover:text-ink"
            title="Calendrier"
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            <span className="hidden lg:inline">Calendrier</span>
          </Link>
          <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
          {FOLLOWED.map((t) => {
            const data = snap.teams[t.id];
            return (
              <Link
                key={t.id}
                href={`/equipe/${t.id}`}
                data-game={t.game}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-dim transition-colors hover:bg-panel-2 hover:text-ink"
                title={`${t.page} · ${GAMES[t.game].label}`}
              >
                <Logo team={{ name: t.page, logo: data?.logo }} size={18} />
                <span className="hidden md:inline">{t.page}</span>
                <span className="font-display text-[11px] font-bold tracking-wider text-[var(--accent)]">
                  {GAMES[t.game].short}
                </span>
              </Link>
            );
          })}
        </nav>
        <Freshness updatedAt={snap.updatedAt} />
        <InstallButton />
      </div>
    </header>
  );
}

/** Le même dessin que l'icône de l'appli (scripts/icons.ts), sur fond clair. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" className="fill-ink" />
      <g transform="translate(14 0)">
        <path
          d="M 340.9 171.1 A 120 120 0 1 0 340.9 340.9"
          fill="none"
          className="stroke-bg"
          strokeWidth="64"
          strokeLinecap="round"
        />
        <rect x="296" y="213" width="84" height="18" rx="9" className="fill-rl" />
        <rect x="296" y="247" width="84" height="18" rx="9" className="fill-cs" />
        <rect x="296" y="281" width="84" height="18" rx="9" className="fill-cod" />
      </g>
    </svg>
  );
}

/**
 * En production, l'instantané n'est publié que quand les données changent :
 * son heure est celle du dernier changement, pas de la dernière vérification.
 * On l'affiche donc sans jugement de fraîcheur.
 */
function Freshness({ updatedAt }: { updatedAt: string | null }) {
  if (!updatedAt) return <span className="shrink-0 text-xs text-faint">jamais synchronisé</span>;
  const ts = Date.parse(updatedAt) / 1000;
  const now = Date.now() / 1000;
  return (
    <span className="hidden shrink-0 text-xs text-faint sm:block" title={`Données modifiées ${relative(ts, now)}`}>
      {dayKey(ts) === dayKey(now) ? clock(ts) : shortDate(ts, now)}
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-xs text-faint sm:px-6">
      <div className="border-t border-line pt-5">
        Données{" "}
        <a href="https://liquipedia.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-dim">
          Liquipedia
        </a>
        , sous licence{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-dim"
        >
          CC BY-SA 3.0
        </a>
        . Chaque compétition renvoie vers sa page source. Horaires à l&apos;heure de Paris.
      </div>
    </footer>
  );
}
