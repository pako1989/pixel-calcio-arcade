import type { MatchConfig, MatchResult } from '../sim/types';
import type { MatchTally } from './tally';

/**
 * Modalità di gioco. Ogni modalità prepara le partite (MatchConfig) e decide
 * cosa succede dopo il fischio finale, sempre sopra la stessa simulazione.
 */
export type ModeId = 'quick' | 'torneo' | 'missioni' | 'mito' | 'conquista' | 'manager' | 'leggenda' | 'sopravvivenza';

export interface ModeInfo {
  id: ModeId;
  title: string;
  desc: string;
  available: boolean;
  /** Scena da aprire quando si sceglie la modalità dal menu. */
  scene: string;
}

export const MODES: ModeInfo[] = [
  { id: 'quick', title: 'PARTITA VELOCE', desc: '5 contro 5 contro la CPU', available: true, scene: 'setup' },
  { id: 'torneo', title: 'TORNEO', desc: 'Coppa a eliminazione diretta', available: true, scene: 'tournament' },
  { id: 'missioni', title: 'MISSIONI', desc: 'Sfide con obiettivi speciali', available: true, scene: 'missions' },
  { id: 'sopravvivenza', title: 'SOPRAVVIVENZA', desc: 'Roguelite 5v5: regole folli, ruba giocatori e scala i round', available: true, scene: 'survival' },
  { id: 'mito', title: 'DIVENTA UN MITO', desc: 'Storia: dal campetto alla Serie A', available: true, scene: 'career' },
  { id: 'conquista', title: 'QUARTIERE VS CITTÀ', desc: 'Saga: conquista l\'Italia città per città', available: true, scene: 'conquista' },
  { id: 'leggenda', title: 'LEGGENDA DEL PALLONE', desc: 'Anime sportivo: duelli, tiri speciali e i Mondiali giovanili', available: true, scene: 'leggenda' },
  { id: 'manager', title: 'MANAGER', desc: 'Guida il tuo club dal quartiere alla Serie Pixel', available: true, scene: 'manager' },
];

/** Dati passati alla scena della partita. */
export interface MatchLaunch {
  config: MatchConfig;
  mode: ModeId;
  /** Partita dimostrativa sullo sfondo del menu. */
  demo?: boolean;
  /** Punteggio di partenza (es. missione "rimonta"). */
  startScore?: [number, number];
  /** Barra del super tiro già carica all'inizio (0..1) per la squadra umana. */
  superStart?: number;
  /** Obiettivo mostrato nell'HUD durante la partita. */
  hudGoal?: string;
  /** Pareggio a fine tempo: si va ai calci di rigore. */
  penalties?: boolean;
  /** Giocatore della squadra 0 da seguire (indice): commenti in diretta e voto nell'HUD. */
  spotlight?: number;
  /** Dati extra della modalità (es. turno del torneo, id della missione). */
  modeData?: unknown;
}

export interface MatchOutcome {
  launch: MatchLaunch;
  result: MatchResult;
  tally: MatchTally;
  /** Punti stile della squadra umana (dribbling, tunnel, gol speciali). */
  style?: number;
}
