import type { GameId } from "../lib/types";

/**
 * Compétitions à surveiller : celles qu'une équipe dispute d'habitude. Elles
 * s'affichent dans « Mes équipes » avant que l'inscription soit confirmée,
 * marquées « à confirmer ». Une règle retient une compétition si son titre de
 * page correspond à `pages` (et à aucun `exclude`), ou si son niveau Liquipedia
 * est dans `tiers`.
 */
export interface WatchRule {
  pages?: RegExp[];
  exclude?: RegExp[];
  tiers?: string[];
}

/** Régions du circuit RLCS, telles qu'elles apparaissent dans les titres de page. */
const RLCS_REGIONS = {
  europe: { label: "Europe", re: "Europe" },
  "north-america": { label: "Amérique du Nord", re: "North America" },
  "south-america": { label: "Amérique du Sud", re: "South America" },
  mena: { label: "Moyen-Orient et Afrique du Nord", re: "Middle East and North Africa" },
  oceania: { label: "Océanie", re: "Oceania" },
  "asia-pacific": { label: "Asie-Pacifique", re: "Asia[- ]Pacific" },
  "sub-saharan-africa": { label: "Afrique subsaharienne", re: "Sub-Saharan Africa" },
} as const;
type RlcsRegion = keyof typeof RLCS_REGIONS;

/** Tout le circuit RLCS, sauf les étapes régionales des autres régions. */
function rlcsRule(region: RlcsRegion): WatchRule {
  const others = Object.entries(RLCS_REGIONS)
    .filter(([k]) => k !== region)
    .map(([, v]) => v.re);
  return { pages: [/^Rocket League Championship Series\//], exclude: [new RegExp(`/(${others.join("|")})(/|$)`)] };
}

/**
 * Règles prêtes à l'emploi : la configuration des équipes, éditable depuis le
 * site, ne stocke que leur nom (une expression régulière ne se sérialise pas).
 */
export const WATCH_PRESETS = {
  ...(Object.fromEntries(
    Object.entries(RLCS_REGIONS).map(([k, v]) => [
      `rlcs-${k}`,
      { label: `Circuit RLCS, étapes ${v.label}`, game: "rocketleague" as GameId, rule: rlcsRule(k as RlcsRegion) },
    ]),
  ) as Record<`rlcs-${RlcsRegion}`, { label: string; game?: GameId; rule?: WatchRule }>),
  "s-tier": { label: "Compétitions S-Tier", rule: { tiers: ["S-Tier"] } },
  "s-a-tier": { label: "Compétitions S-Tier et A-Tier", rule: { tiers: ["S-Tier", "A-Tier"] } },
  cdl: { label: "Toute la Call of Duty League", game: "callofduty" as GameId, rule: { pages: [/^Call of Duty League\//] } },
  none: { label: "Aucune" },
} satisfies Record<string, { label: string; game?: GameId; rule?: WatchRule }>;

export type WatchPreset = keyof typeof WATCH_PRESETS;

/** Une équipe suivie telle qu'on la stocke (réglages, instantané). */
export interface TeamConfig {
  /** Segment d'URL de la page équipe (/equipe/<id>). */
  id: string;
  game: GameId;
  /** Titre exact de la page Liquipedia de l'équipe. */
  page: string;
  /** Autres noms sous lesquels l'équipe apparaît dans les tableaux. */
  aliases?: string[];
  watch?: WatchPreset;
}

/** Une équipe suivie, prête à l'emploi : sa règle de surveillance est résolue. */
export interface FollowedTeam extends Omit<TeamConfig, "watch"> {
  preset?: WatchPreset;
  watch?: WatchRule;
}

export function toFollowed(cfg: TeamConfig): FollowedTeam {
  const preset = cfg.watch && cfg.watch in WATCH_PRESETS ? cfg.watch : undefined;
  const rule = preset ? (WATCH_PRESETS[preset] as { rule?: WatchRule }).rule : undefined;
  return { id: cfg.id, game: cfg.game, page: cfg.page, aliases: cfg.aliases, preset, watch: rule };
}

/** Les équipes suivies tant que rien n'a été réglé depuis le site. */
export const DEFAULT_TEAMS: TeamConfig[] = [
  // Équipe européenne : tout le circuit RLCS, sauf les étapes des autres régions.
  { id: "m8-rl", game: "rocketleague", page: "Gentle Mates", watch: "rlcs-europe" },
  // Équipe du plus haut niveau : les compétitions S-Tier.
  { id: "vitality-cs2", game: "counterstrike", page: "Team Vitality", watch: "s-tier" },
  // Franchise de la CDL : elle en joue tous les événements.
  { id: "m8-cdl", game: "callofduty", page: "Paris Gentle Mates", aliases: ["Los Angeles Guerrillas M8"], watch: "cdl" },
];

export const FOLLOWED: FollowedTeam[] = DEFAULT_TEAMS.map(toFollowed);

export const GAMES: Record<GameId, { label: string; short: string }> = {
  rocketleague: { label: "Rocket League", short: "RL" },
  counterstrike: { label: "Counter-Strike 2", short: "CS2" },
  callofduty: { label: "Call of Duty League", short: "CDL" },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];

/**
 * Listes par niveau lues chaque jour : elles annoncent les grandes
 * compétitions des mois à l'avance. La CDL est classée A-Tier pour ses
 * événements d'ouverture, d'où la seconde liste.
 */
export const TIER_LISTS: Record<GameId, string[]> = {
  rocketleague: ["S-Tier Tournaments"],
  counterstrike: ["S-Tier Tournaments"],
  callofduty: ["S-Tier Tournaments", "A-Tier Tournaments"],
};

/**
 * Saisons des circuits : `{N}` est le numéro ou l'année. La synchro prend la
 * saison la plus récente qui existe et lit les dates de toutes ses
 * compétitions, avant même qu'elles figurent dans les listes par niveau.
 */
export const SEASON_PREFIXES: Record<GameId, string[]> = {
  rocketleague: ["Rocket League Championship Series/Club Championship/{N}/", "Rocket League Championship Series/{N}/"],
  counterstrike: [],
  callofduty: ["Call of Duty League/Season {N}/"],
};

/** Fuseau d'affichage de tous les horaires. */
export const TIMEZONE = "Europe/Paris";

/**
 * Compétitions à ne jamais suivre même si une équipe suivie y joue,
 * testées sur le titre de la page et sur le nom affiché.
 */
export const IGNORE_TOURNAMENTS: RegExp[] = [];

/**
 * Un wiki Liquipedia couvre parfois plusieurs jeux : celui de Call of Duty
 * mêle la CDL à Call of Duty Mobile et Warzone. Une compétition dont le nom ou
 * le champ « Game » de l'infobox correspond est écartée du calendrier.
 */
export const OTHER_TITLES: Partial<Record<GameId, RegExp>> = {
  callofduty: /mobile|warzone|\bcodm\b/i,
};
