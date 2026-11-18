import type { MatchConfig, MatchResult } from '../sim/types';

/**
 * Modalità di gioco. Ogni modalità prepara le partite (MatchConfig) e decide
 * cosa succede dopo il fischio finale. Per ora è attiva la partita veloce;
 * le altre sono pronte nel menu e verranno costruite sopra la stessa simulazione.
 */
export type ModeId = 'quick' | 'torneo' | 'missioni' | 'mito' | 'manager';

export interface ModeInfo {
  id: ModeId;
  title: string;
  desc: string;
  available: boolean;
}

export const MODES: ModeInfo[] = [
  { id: 'quick', title: 'PARTITA VELOCE', desc: '5 contro 5 contro la CPU', available: true },
  { id: 'torneo', title: 'TORNEO', desc: 'Coppa a eliminazione diretta', available: false },
  { id: 'missioni', title: 'MISSIONI', desc: 'Sfide con obiettivi speciali', available: false },
  { id: 'mito', title: 'DIVENTA UN MITO', desc: 'Dal campetto alla Serie A', available: false },
];

/** Dati passati alla scena della partita. */
export interface MatchLaunch {
  config: MatchConfig;
  mode: ModeId;
  /** Partita dimostrativa sullo sfondo del menu. */
  demo?: boolean;
  /** Dati extra della modalità (es. turno del torneo, obiettivo della missione). */
  modeData?: unknown;
}

export interface MatchOutcome {
  launch: MatchLaunch;
  result: MatchResult;
}
