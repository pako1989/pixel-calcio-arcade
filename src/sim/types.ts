/**
 * Tipi condivisi da simulazione, modalità di gioco e (in futuro) manageriale.
 * La simulazione non dipende da Phaser: può girare anche "senza grafica"
 * (test, partite simulate della carriera o del manageriale).
 */

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

/** Statistiche di un giocatore, da 0.5 (scarso) a 1.2 (campione). */
export interface PlayerStats {
  speed: number;
  shot: number;
  pass: number;
  tackle: number;
  control: number;
  keeping: number;
}

export interface PlayerDef {
  name: string;
  number: number;
  role: Role;
  stats: PlayerStats;
  /** Aspetto: indici nelle palette di pelle e capelli, stile capelli. */
  look: { skin: number; hair: number; hairStyle: number };
}

export interface TeamDef {
  id: string;
  name: string;
  short: string;
  /** Colori in esadecimale (0xRRGGBB). */
  colors: { shirt: number; shirt2: number; shorts: number; socks: number; gk: number };
  /** Disegno della maglia. */
  pattern: 'plain' | 'stripes' | 'hoops' | 'half' | 'sash';
  players: PlayerDef[];
  /** Forza complessiva 1–5 (stelle). */
  stars: number;
}

export type Difficulty = 'facile' | 'normale' | 'difficile';

export type PitchId = 'stadio' | 'spiaggia' | 'neve' | 'tetto' | 'quartiere';

export interface PitchDef {
  id: PitchId;
  name: string;
  rule: string;
  width: number;
  height: number;
  goalWidth: number;
  /** Modificatori fisici. */
  ballFriction: number;
  ballBounce: number;
  wallBounce: number;
  playerSpeed: number;
  /** 1 = aderenza normale, valori bassi = si scivola. */
  playerGrip: number;
  wind: boolean;
}

export interface MatchConfig {
  home: TeamDef;
  away: TeamDef;
  pitch: PitchDef;
  difficulty: Difficulty;
  durationSec: number;
  powerUps: boolean;
  /** Pareggio a fine tempo: si continua fino al prossimo gol. */
  goldenGoal: boolean;
  seed?: number;
  /** Squadra controllata dal giocatore umano (0 = casa, null = CPU contro CPU). */
  humanTeam: 0 | 1 | null;
}

export interface MatchStats {
  shots: [number, number];
  passes: [number, number];
  tackles: [number, number];
  possession: [number, number];
}

export interface MatchResult {
  score: [number, number];
  stats: MatchStats;
  goldenGoal: boolean;
  scorers: { team: 0 | 1; name: string; time: number }[];
}
