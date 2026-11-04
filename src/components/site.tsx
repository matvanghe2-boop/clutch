import Link from "next/link";
import { FOLLOWED, GAMES } from "@/config/follow";
import { clock, dayKey, relative, shortDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import { Logo } from "./ui";

export async function SiteHeader() {
  const snap = await loadSnapshot();
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-ink font-display text-lg font-bold leading-none text-bg transition-transform group-hover:-rotate-6">
            C
          </span>
          <span className="font-display text-xl font-bold tracking-[0.14em]">CLUTCH</span>
        </Link>
        <nav className="scrollbar-thin -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
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
      </div>
    </header>
  );
}

/**
 * En production, l'instantané n'est commité que quand les données changent :
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
