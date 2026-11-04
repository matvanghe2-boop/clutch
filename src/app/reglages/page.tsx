import type { Metadata } from "next";
import { GAME_IDS, GAMES, toFollowed, WATCH_PRESETS, type WatchPreset } from "@/config/follow";
import { addTeam, lock, removeTeam, setTeamWatch, showCompetition, unlock } from "@/app/actions";
import { cn, Empty, GameTag, Logo, SectionTitle } from "@/components/ui";
import { currentTeams, isAdmin } from "@/lib/admin";
import { readHidden } from "@/lib/hidden";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { GameId } from "@/lib/types";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const field =
  "rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-faint focus:outline-none disabled:opacity-50";
const input = `w-full ${field}`;
const button = "rounded-lg border border-line px-3 py-1.5 text-xs text-dim transition-colors hover:text-ink disabled:opacity-40";

/** Règles proposées pour un jeu : celles de ce jeu, plus les règles par niveau, communes à tous. */
function presetsFor(game: GameId): WatchPreset[] {
  return (Object.keys(WATCH_PRESETS) as WatchPreset[]).filter((p) => {
    const g = (WATCH_PRESETS[p] as { game?: GameId }).game;
    return !g || g === game;
  });
}

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : undefined;
  const error = typeof sp.erreur === "string" ? sp.erreur : undefined;
  const [teams, snap, hidden, admin] = await Promise.all([currentTeams(), loadSnapshot(), readHidden(), isAdmin()]);
  const pinSet = Boolean(process.env.CLUTCH_ADMIN_PIN);

  // Noms lisibles des compétitions masquées, d'après l'instantané et les listes.
  const names = new Map<string, string>();
  for (const t of Object.values(snap.tournaments)) names.set(t.key, t.name);
  for (const l of [...Object.values(snap.portals ?? {}), ...Object.values(snap.listings ?? {})])
    for (const e of l?.entries ?? []) if (!names.has(`${e.wiki}:${e.page}`)) names.set(`${e.wiki}:${e.page}`, e.name);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Réglages</h1>
        <p className="mt-1 text-sm text-dim">
          Les équipes suivies sont communes à tout le site ; les compétitions masquées ne valent que pour ce navigateur.
        </p>
      </header>

      {ok && <div className="rounded-xl border border-win/30 bg-win/10 px-4 py-3 text-sm text-win">{ok}</div>}
      {error && <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">{error}</div>}

      {!pinSet ? (
        <div className="rounded-xl border border-cs/30 bg-cs/10 px-4 py-3 text-sm text-cs">
          Pour modifier les équipes, définis un code dans la variable <code>CLUTCH_ADMIN_PIN</code> (Vercel → projet clutch →
          Settings → Environment Variables), puis redéploie. En attendant, les équipes restent en lecture seule.
        </div>
      ) : admin ? (
        <form action={lock} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-dim">
          <span>Réglages déverrouillés sur ce navigateur.</span>
          <button className={button}>Verrouiller</button>
        </form>
      ) : (
        <form action={unlock} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-dim">
          <span className="min-w-48 flex-1">Saisis ton code pour modifier les équipes.</span>
          <input type="password" name="pin" placeholder="Code" autoComplete="current-password" className={cn(field, "w-36")} required />
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90">Déverrouiller</button>
        </form>
      )}

      <section>
        <SectionTitle>Équipes suivies</SectionTitle>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {teams.map((cfg) => {
            const team = toFollowed(cfg);
            return (
              <li key={cfg.id} data-game={cfg.game} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                <div className="flex min-w-48 flex-1 items-center gap-3">
                  <Logo team={{ name: cfg.page, logo: snap.teams[cfg.id]?.logo }} size={28} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cfg.page}</span>
                      <GameTag game={cfg.game} />
                    </div>
                    <div className="text-xs text-faint">
                      {team.preset ? WATCH_PRESETS[team.preset].label : "Aucune surveillance"}
                      {!snap.teams[cfg.id] && " · en attente de la prochaine synchro"}
                    </div>
                  </div>
                </div>
                <form action={setTeamWatch} className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                  <input type="hidden" name="id" value={cfg.id} />
                  <select
                    name="watch"
                    defaultValue={cfg.watch ?? "none"}
                    className={cn(field, "min-w-0 flex-1 py-1.5 sm:flex-none")}
                    aria-label="Compétitions à surveiller"
                    disabled={!admin}
                  >
                    {presetsFor(cfg.game).map((p) => (
                      <option key={p} value={p}>
                        {WATCH_PRESETS[p].label}
                      </option>
                    ))}
                  </select>
                  <button className={button} disabled={!admin}>
                    Enregistrer
                  </button>
                </form>
                <form action={removeTeam}>
                  <input type="hidden" name="id" value={cfg.id} />
                  <button className={cn(button, "border-loss/40 text-loss hover:bg-loss/10 hover:text-loss")} disabled={!admin}>
                    Retirer
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle>Ajouter une équipe</SectionTitle>
        <form action={addTeam} className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm text-dim">
            <span>Jeu</span>
            <select name="game" className={input} defaultValue="rocketleague" disabled={!admin}>
              {GAME_IDS.map((g) => (
                <option key={g} value={g}>
                  {GAMES[g].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-dim">
            <span>Page Liquipedia de l&apos;équipe</span>
            <input name="page" placeholder="Karmine Corp" className={input} required disabled={!admin} />
          </label>
          <label className="space-y-1 text-sm text-dim">
            <span>Compétitions à surveiller</span>
            <select name="watch" className={input} defaultValue="none" disabled={!admin}>
              {(Object.keys(WATCH_PRESETS) as WatchPreset[]).map((p) => (
                <option key={p} value={p}>
                  {WATCH_PRESETS[p].label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40" disabled={!admin}>
              Ajouter
            </button>
            <p className="mt-2 text-xs text-faint">
              Le titre de la page sur le wiki du jeu (liquipedia.net/rocketleague/<b>Karmine_Corp</b> → « Karmine Corp »). Huit
              équipes au plus : chaque page coûte 30 s de synchro. Les matchs d&apos;une nouvelle équipe arrivent en quelques minutes.
            </p>
          </div>
        </form>
      </section>

      <section>
        <SectionTitle>Compétitions masquées</SectionTitle>
        {hidden.size ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {[...hidden].map((key) => (
              <li key={key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate">{names.get(key) ?? key.split(":").slice(1).join(":")}</span>
                <form action={showCompetition}>
                  <input type="hidden" name="key" value={key} />
                  <button className={button}>Réafficher</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune. Le bouton « Masquer » de la liste des compétitions, dans le calendrier, les retire de ta vue.</Empty>
        )}
      </section>
    </div>
  );
}
