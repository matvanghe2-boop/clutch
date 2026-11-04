import type { GameId } from "../lib/types";

export interface FollowedTeam {
  /** Segment d'URL de la page équipe (/equipe/<id>). */
  id: string;
  game: GameId;
  /** Titre exact de la page Liquipedia de l'équipe. */
  page: string;
  /** Autres noms sous lesquels l'équipe apparaît dans les tableaux. */
  aliases?: string[];
}

export const FOLLOWED: FollowedTeam[] = [
  { id: "m8-rl", game: "rocketleague", page: "Gentle Mates" },
  { id: "vitality-cs2", game: "counterstrike", page: "Team Vitality" },
  { id: "m8-cdl", game: "callofduty", page: "Paris Gentle Mates", aliases: ["Los Angeles Guerrillas M8"] },
];

export const GAMES: Record<GameId, { label: string; short: string }> = {
  rocketleague: { label: "Rocket League", short: "RL" },
  counterstrike: { label: "Counter-Strike 2", short: "CS2" },
  callofduty: { label: "Call of Duty League", short: "CDL" },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];

/** Fuseau d'affichage de tous les horaires. */
export const TIMEZONE = "Europe/Paris";

/**
 * Compétitions à ne jamais suivre même si une équipe suivie y joue,
 * testées sur le titre de la page et sur le nom affiché.
 */
export const IGNORE_TOURNAMENTS: RegExp[] = [];
