import type { TeamConfig } from "../config/follow";

/** Les trois wikis Liquipedia suivis. Le nom est celui du sous-domaine de l'API. */
export type GameId = "rocketleague" | "counterstrike" | "callofduty";

export interface TeamRef {
  /** Nom complet tel qu'affiché par Liquipedia. */
  name: string;
  /** Abréviation (M8, VIT…). */
  short?: string;
  /** Titre de la page Liquipedia, avec des espaces (« Gentle Mates »). */
  page?: string;
  /** URL absolue du logo, variante sombre de préférence. */
  logo?: string;
}

export interface Stream {
  platform: string;
  channel: string;
  url: string;
  /** Chaîne française ajoutée par Clutch (co-stream, dirigeants du club), pas une diffusion officielle. */
  fr?: boolean;
}

/** Une manche (map) d'un match. */
export interface GameResult {
  map?: string;
  score1?: string;
  score2?: string;
  winner?: 1 | 2;
}

export interface TournamentRef {
  name: string;
  /** Titre de la page de la compétition. */
  page?: string;
  /** Ancre de la phase dans la page (« Day 2 »). */
  anchor?: string;
  stage?: string;
}

export interface Match {
  /** Identifiant stable : sert à dédoublonner un même match vu sur deux pages. */
  id: string;
  wiki: GameId;
  /** Secondes depuis l'epoch ; absent quand Liquipedia n'a pas encore d'horaire. */
  timestamp?: number;
  /**
   * Le jour est connu, pas l'heure. `timestamp` vaut alors la fin de soirée de
   * ce jour (heure de Paris), pour le ranger après les matchs à l'heure connue.
   */
  timeTbd?: boolean;
  finished: boolean;
  opponents: [TeamRef | null, TeamRef | null];
  scores: [string | null, string | null];
  winner?: 1 | 2;
  bestOf?: number;
  tournament?: TournamentRef;
  /** Tour dans la phase (« Round 1 », « Upper Bracket Semifinals »). */
  round?: string;
  streams: Stream[];
  games: GameResult[];
}

/** Une ronde d'un classement suisse : résultat, score et adversaire. */
export interface SwissRound {
  result?: "win" | "loss" | "draw";
  score?: string;
  opponent?: TeamRef | null;
}

export interface StandingRow {
  rank: string;
  team: TeamRef | null;
  /** Cellules chiffrées dans l'ordre de Liquipedia (bilan, manches, différence…). */
  cells: string[];
  status?: "up" | "down" | "stay" | "stayup" | "staydown" | "draw";
  rounds?: SwissRound[];
}

export interface StandingTable {
  title: string;
  /** Intitulés des cellules chiffrées, quand Liquipedia les donne. */
  headers?: string[];
  rows: StandingRow[];
}

export interface BracketNode {
  match: Match | null;
  /** Équipes qualifiées affichées dans la dernière colonne, sans match. */
  qualified?: TeamRef[];
  /** Colonnes laissées vides entre ce match et son parent (`--skip-round` de Liquipedia). */
  skip?: number;
  children: BracketNode[];
}

/** Une ligne d'en-têtes de tours et les arbres qu'elle coiffe (bracket haut, bas…). */
export interface BracketSection {
  headers: string[];
  roots: BracketNode[];
}

export interface Bracket {
  sections: BracketSection[];
}

export interface Matchlist {
  title: string;
  matches: Match[];
}

export type StageBlock =
  | { kind: "group"; table: StandingTable }
  | { kind: "bracket"; bracket: Bracket }
  | { kind: "matchlist"; list: Matchlist };

export interface Stage {
  title: string;
  /** Ancre de la section sur Liquipedia, pour retrouver la phase d'un lien. */
  anchor: string;
  blocks: StageBlock[];
}

export interface Tournament {
  key: string;
  wiki: GameId;
  page: string;
  name: string;
  /** Champs de l'infobox : Start Date, End Date, Prize Pool, Location… */
  info: Record<string, string>;
  /** Dates de l'infobox, AAAA-MM-JJ, quand elles sont complètes. */
  startDate?: string;
  endDate?: string;
  /** Équipes annoncées dans la section Participants. */
  participants?: TeamRef[];
  /**
   * Une équipe suivie y joue (participants, matchs ou poules). Faux pour une
   * compétition connue par la liste du jeu seulement : ses phases ne sont pas
   * gardées, elle ne sert qu'à la vue d'ensemble du calendrier.
   */
  participating?: boolean;
  stages: Stage[];
  fetchedAt: string;
}

/** Une ligne de la liste des compétitions d'un jeu (Liquipedia:Tournaments). */
export interface PortalEntry {
  wiki: GameId;
  page: string;
  name: string;
  status: "upcoming" | "ongoing" | "completed";
  /** AAAA-MM-JJ ; l'année, absente de la liste, est déduite. */
  startDate?: string;
  endDate?: string;
  /** Renseignés par les listes par niveau (« S-Tier Tournaments »). */
  location?: string;
  prize?: string;
  tier?: string;
}

export interface Portal {
  entries: PortalEntry[];
  fetchedAt: string;
}

export interface RecentMatch {
  timestamp: number;
  tournament: TournamentRef;
  tier?: string;
  /** Score du point de vue de l'équipe suivie : [elle, adversaire]. */
  score: [string, string];
  result: "win" | "loss" | "draw";
  opponent: TeamRef | null;
}

export interface RosterEntry {
  /** Pseudo. */
  id: string;
  name?: string;
  /** Rôle ou statut (« RFA », « Coach »…), quand Liquipedia le précise. */
  role?: string;
  /** Date d'arrivée, AAAA-MM-JJ. */
  joined?: string;
  country?: string;
  captain?: boolean;
}

export interface TeamSnapshot {
  id: string;
  name: string;
  logo?: string;
  upcoming: Match[];
  recent: RecentMatch[];
  /** Effectif actif. */
  roster?: RosterEntry[];
  /** Derniers mouvements de la chronologie (« 28 octobre – X rejoint l'équipe »), du plus récent au plus ancien. */
  timeline?: string[];
  fetchedAt: string;
}

export interface Snapshot {
  version: 1;
  updatedAt: string | null;
  /**
   * Fin de la dernière passe de synchro, qu'elle ait trouvé du nouveau ou non.
   * Publiée au moins toutes les deux heures : c'est le signal de vie de la synchro.
   */
  checkedAt?: string;
  /** Les équipes suivies lors de la dernière passe (réglages du site, sinon valeurs par défaut). */
  followed?: TeamConfig[];
  /**
   * Historique des matchs de chaque équipe suivie : page « /Matches » quand elle
   * existe, plus tous les résultats vus depuis. Sert aux face-à-face.
   */
  history?: Record<string, RecentMatch[]>;
  /** Dernière lecture de la page « /Matches » de chaque équipe. */
  historyFetchedAt?: Record<string, string>;
  teams: Record<string, TeamSnapshot>;
  tournaments: Record<string, Tournament>;
  /** Liste des compétitions à venir, en cours et terminées de chaque jeu. */
  portals?: Partial<Record<GameId, Portal>>;
  /**
   * Listes par niveau (« S-Tier Tournaments »…), clé « wiki:page » : elles
   * annoncent les grandes compétitions des mois à l'avance.
   */
  listings?: Record<string, Portal>;
  /**
   * Adversaires des prochains matchs, clé « wiki:page » : effectif et derniers
   * résultats lus sur leur page Liquipedia, une fois par jour.
   */
  opponents?: Record<string, OpponentSnapshot>;
  /** Classements de saison par jeu (clé : le wiki). */
  rankings?: Partial<Record<GameId, Ranking>>;
  /** Échecs récents par clé de tâche, pour espacer les nouvelles tentatives. */
  failures: Record<string, { at: string; message: string }>;
}

export interface RankingRow {
  rank: number;
  team: TeamRef;
  points?: string;
  /** Région de l'équipe (VRS : EU, AM, AS) et son rang dans sa région. */
  region?: string;
  regionRank?: number;
  regionName?: string;
  /** Cellules du tableau, dans l'ordre de `columns` (classement CDL : matchs, manches, points…). */
  cells?: string[];
}

/** Un classement de saison (VRS de Valve, saison régulière CDL). */
export interface Ranking {
  wiki: GameId;
  page: string;
  title: string;
  /** Date de mise à jour annoncée par la page, AAAA-MM-JJ. */
  updated?: string;
  columns: string[];
  /** Les premiers du classement, plus mes équipes et leurs adversaires où qu'ils soient. */
  rows: RankingRow[];
  fetchedAt: string;
}

export interface OpponentSnapshot {
  wiki: GameId;
  page: string;
  name: string;
  logo?: string;
  roster: RosterEntry[];
  /** Ses derniers résultats, de son point de vue, du plus récent au plus ancien. */
  recent: RecentMatch[];
  fetchedAt: string;
}
