import Link from "next/link";
import { after } from "next/server";
import { GAMES } from "@/config/follow";
import { liveSoon, matchHref, recentFeed, statusOf, teamsOf, upcomingFeed } from "@/lib/derive";
import { clock, dayKey, relative, shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { matchMorph, teamMorph } from "@/lib/morph-attrs";
import { autoRefresh, STALE_MS } from "@/lib/sync/auto";
import { accentOf } from "@/lib/team-colors";
import { LiveRefresher } from "./LiveRefresher";
import { NavIndicator, NavLink } from "./Motion";
import { InstallButton } from "./Pwa";
import { Logo } from "./ui";

/**
 * Le fil d'information sous l'en-tête : ce qui se joue, ce qui vient, ce qui s'est joué.
 * Il défile en boucle, s'arrête au survol, et reste un simple défilement manuel pour qui
 * a désactivé les animations.
 */
function Ticker({ snap, now }: { snap: Awaited<ReturnType<typeof loadSnapshot>>; now: number }) {
  const upcoming = upcomingFeed(snap).filter((o) => statusOf(o.match, now) !== "stale").slice(0, 6);
  const results = recentFeed(snap).slice(0, 10);
  if (!upcoming.length && !results.length) return null;
  const items = (
    <div aria-hidden={false}>
      {upcoming.map((o) => {
        const status = statusOf(o.match, now);
        const isLive = status === "live";
        return (
          <Link key={o.match.id} href={matchHref(o.match)} data-game={o.match.wiki} style={accentOf(o.us)} {...matchMorph(o.us, o.them)} className="flex shrink-0 items-center gap-2 text-xs text-dim transition-colors hover:text-ink">
            {isLive ? (
              <span className="flex items-center gap-1.5 font-display font-extrabold italic tracking-wider text-live">
                <span className="live-dot size-1.5 rounded-full bg-live" />
                LIVE
              </span>
            ) : (
              <span className="font-display font-bold italic text-[var(--accent)]">
                {o.match.timestamp ? `${dayKey(o.match.timestamp) === dayKey(now) ? "" : `${shortDate(o.match.timestamp, now)} `}${o.match.timeTbd ? "" : clock(o.match.timestamp)}` : "À venir"}
              </span>
            )}
            <Logo team={o.us} size={14} />
            <span className="font-medium text-ink">{o.us.short ?? o.us.name}</span>
            <span className="text-faint">{isLive ? `${o.usScore ?? 0} – ${o.themScore ?? 0}` : "vs"}</span>
            <Logo team={o.them} size={14} />
            <span className="font-medium text-ink">{o.them?.short ?? o.them?.name ?? "?"}</span>
          </Link>
        );
      })}
      {results.map((r) => {
        const body = (
          <>
            <span className={r.result === "win" ? "font-display font-extrabold italic text-win" : r.result === "loss" ? "font-display font-extrabold italic text-loss" : "font-display font-extrabold italic text-dim"}>
              {r.result === "win" ? "V" : r.result === "loss" ? "D" : "N"}
            </span>
            <span className="font-medium text-ink">{r.team.page}</span>
            <span className="font-display font-bold tabular-nums text-ink">
              {r.usScore}–{r.themScore}
            </span>
            <Logo team={r.opponent} size={14} />
            <span className="text-dim">{r.opponent?.short ?? r.opponent?.name}</span>
          </>
        );
        return r.matchId ? (
          <Link key={`${r.team.id}-${r.timestamp}`} href={`/match/${encodeURIComponent(r.matchId)}`} {...matchMorph({ name: r.team.page, page: r.team.page }, r.opponent)} className="flex shrink-0 items-center gap-2 text-xs transition-opacity hover:opacity-80">
            {body}
          </Link>
        ) : (
          <span key={`${r.team.id}-${r.timestamp}`} className="flex shrink-0 items-center gap-2 text-xs">
            {body}
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="ticker" aria-label="Fil des matchs">
      <div className="ticker-track py-1.5" style={{ "--ticker-duration": `${(upcoming.length + results.length) * 7}s` } as React.CSSProperties}>
        {items}
        {/* Deuxième copie : la boucle se referme sans à-coup. Masquée aux lecteurs d'écran. */}
        <div aria-hidden inert>
          {items.props.children}
        </div>
      </div>
    </div>
  );
}

/** Dans le menu, le nom court : la page de l'équipe garde le nom complet. */
const NAV_LABELS: Record<string, string> = { "Paris Gentle Mates": "Paris", "Team Vitality": "Vitality" };

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
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <Mark className="size-7 transition-transform group-hover:-rotate-6" />
          <span className="brand-text display text-2xl tracking-[0.1em]">CLUTCH</span>
        </Link>
        <nav className="site-nav -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1">
          <NavLink href="/ce-soir" title="Ce soir">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
            </svg>
            <span className="hidden lg:inline">Ce soir</span>
          </NavLink>
          <NavLink href="/calendrier" title="Calendrier">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            <span className="hidden lg:inline">Calendrier</span>
          </NavLink>
          <NavLink href="/pronostics" title="Pronostics">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
            <span className="hidden lg:inline">Pronos</span>
          </NavLink>
          <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
          {teamsOf(snap).map((t) => {
            const data = snap.teams[t.id];
            return (
              <NavLink key={t.id} href={`/equipe/${t.id}`} game={t.game} style={accentOf({ name: t.page, page: t.page, logo: data?.logo })} morph={teamMorph({ name: t.page, page: t.page, logo: data?.logo })} title={`${t.page} · ${GAMES[t.game].label}`}>
                <Logo team={{ name: t.page, logo: data?.logo }} size={18} />
                <span className="hidden md:inline">{NAV_LABELS[t.page] ?? t.page}</span>
                <span className="font-display text-[11px] font-bold tracking-wider text-[var(--accent)]">
                  {GAMES[t.game].short}
                </span>
              </NavLink>
            );
          })}
          <NavIndicator />
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
    <Ticker snap={snap} now={now} />
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

/** La forme d'une page en attendant le serveur. Affiché seulement si la réponse tarde (voir fx.css). */
export function NavSkeleton() {
  return (
    <div className="nav-skeleton" aria-hidden>
      <div className="sk sk-arena" />
      <div className="sk sk-title" />
      <div className="sk sk-row" />
      <div className="sk sk-row" />
      <div className="sk sk-row" />
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
