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

export interface FollowedTeam {
  /** Segment d'URL de la page équipe (/equipe/<id>). */
  id: string;
  game: GameId;
  /** Titre exact de la page Liquipedia de l'équipe. */
  page: string;
  /** Autres noms sous lesquels l'équipe apparaît dans les tableaux. */
  aliases?: string[];
  watch?: WatchRule;
}

/** Étapes régionales RLCS d'autres régions que l'Europe. */
const NON_EU_REGIONS = /\/(North America|South America|Middle East and North Africa|Oceania|Asia[- ]Pacific|Asia|Sub-Saharan Africa|APAC|MENA|SAM|OCE|SSA)(\/|$)/;

export const FOLLOWED: FollowedTeam[] = [
  {
    id: "m8-rl",
    game: "rocketleague",
    page: "Gentle Mates",
    // Équipe européenne : tout le circuit RLCS, sauf les étapes des autres régions.
    watch: { pages: [/^Rocket League Championship Series\//], exclude: [NON_EU_REGIONS] },
  },
  {
    id: "vitality-cs2",
    game: "counterstrike",
    page: "Team Vitality",
    // Équipe du plus haut niveau : les compétitions S-Tier.
    watch: { tiers: ["S-Tier"] },
  },
  {
    id: "m8-cdl",
    game: "callofduty",
    page: "Paris Gentle Mates",
    aliases: ["Los Angeles Guerrillas M8"],
    // Franchise de la CDL : elle en joue tous les événements.
    watch: { pages: [/^Call of Duty League\//] },
  },
];

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
