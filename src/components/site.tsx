import Link from "next/link";
import { after } from "next/server";
import { GAMES } from "@/config/follow";
import { liveSoon, teamsOf } from "@/lib/derive";
import { clock, dayKey, relative, shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { autoRefresh, STALE_MS } from "@/lib/sync/auto";
import { LiveRefresher } from "./LiveRefresher";
import { InstallButton } from "./Pwa";
import { Logo } from "./ui";

const navLink = "flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-dim transition-colors hover:bg-panel-2 hover:text-ink";

export async function SiteHeader() {
  const snap = await loadSnapshot();
  const now = Date.now() / 1000;
  const live = liveSoon(snap, now);
  // Après l'envoi de la page : synchro de secours ou mode « match en cours », si besoin.
  after(() => autoRefresh(snap).catch((e) => console.error("[clutch] passe de secours :", e)));
  return (
    <>
    {/*
      Installée sur iPhone, l'appli s'étend sous la barre d'état. Le header Orbit,
      au-dessus, s'en écarte ; une fois la page défilée, cet en-tête se colle juste
      sous la barre d'état, qu'un aplat fixe garde opaque. Ailleurs, la marge vaut 0.
    */}
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg" />
    <header className="sticky top-[env(safe-area-inset-top)] z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <Mark className="size-7 transition-transform group-hover:-rotate-6" />
          <span className="font-display text-xl font-bold tracking-[0.14em]">CLUTCH</span>
        </Link>
        <nav className="scrollbar-thin -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          <Link href="/calendrier" className={navLink} title="Calendrier">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            <span className="hidden lg:inline">Calendrier</span>
          </Link>
          <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
          {teamsOf(snap).map((t) => {
            const data = snap.teams[t.id];
            return (
              <Link key={t.id} href={`/equipe/${t.id}`} data-game={t.game} className={navLink} title={`${t.page} · ${GAMES[t.game].label}`}>
                <Logo team={{ name: t.page, logo: data?.logo }} size={18} />
                <span className="hidden md:inline">{t.page}</span>
                <span className="font-display text-[11px] font-bold tracking-wider text-[var(--accent)]">
                  {GAMES[t.game].short}
                </span>
              </Link>
            );
          })}
        </nav>
        <Freshness checkedAt={snap.checkedAt ?? snap.updatedAt} />
        <InstallButton />
        <Link href="/reglages" className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-panel-2 hover:text-ink" title="Réglages">
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
      <StaleBanner checkedAt={snap.checkedAt ?? snap.updatedAt} now={now} />
      <LiveRefresher active={live} />
    </header>
    </>
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

/** Heure de la dernière vérification par la synchro (signal de vie publié au moins toutes les 2 h). */
function Freshness({ checkedAt }: { checkedAt?: string | null }) {
  if (!checkedAt) return <span className="shrink-0 text-xs text-faint">jamais synchronisé</span>;
  const ts = Date.parse(checkedAt) / 1000;
  const now = Date.now() / 1000;
  return (
    <span className="hidden shrink-0 text-xs text-faint sm:block" title={`Données vérifiées ${relative(ts, now)}`}>
      {dayKey(ts) === dayKey(now) ? clock(ts) : shortDate(ts, now)}
    </span>
  );
}

/**
 * La synchro publie au moins toutes les deux heures : au-delà de 2 h 30 sans
 * nouvelles, elle est en retard. La visite a déjà lancé une passe de secours.
 */
function StaleBanner({ checkedAt, now }: { checkedAt?: string | null; now: number }) {
  if (!checkedAt) return null;
  const ts = Date.parse(checkedAt) / 1000;
  if ((now - ts) * 1000 < STALE_MS) return null;
  return (
    <div className="border-t border-cs/30 bg-cs/10 px-4 py-1.5 text-center text-xs text-cs">
      Données vérifiées {relative(ts, now)} : la synchronisation automatique a pris du retard. Une mise à jour vient
      d&apos;être lancée, recharge la page dans une minute.
    </div>
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
