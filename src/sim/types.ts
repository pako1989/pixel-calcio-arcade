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
  /** Abilità sbloccate con la crescita (es. 'giro', 'motore'). */
  skills?: string[];
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

export type FormationId = '1-2-1' | '1-1-2' | '2-1-1';

export type PitchId =
  | 'stadio'
  | 'spiaggia'
  | 'neve'
  | 'tetto'
  | 'quartiere'
  | 'piazza'
  | 'montagna'
  | 'molo'
  | 'flipper'
  | 'fango'
  | 'vulcano';

/** Ostacolo rotondo in campo (fontana, statua): la palla rimbalza, i giocatori ci girano intorno. */
export interface Obstacle {
  kind: 'fontana' | 'statua';
  x: number;
  y: number;
  r: number;
  /** Altezza: la palla più alta ci passa sopra. */
  h: number;
}

/** Respingente elastico stile flipper: rilancia la palla ad alta velocità. */
export interface Bumper {
  x: number;
  y: number;
  r: number;
  boost: number;
}

/** Pozzanghera di fango ellittica: rallenta corsa e pallone rasoterra. */
export interface MudZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Geyser vulcanico periodico: erutta lanciando in aria la palla. */
export interface Geyser {
  x: number;
  y: number;
  r: number;
  period: number;
  phase: number;
}

/** Meteo della partita: cambia la fisica (pioggia) o la visuale (nebbia). */
export type Weather = 'sereno' | 'pioggia' | 'nebbia';

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
  /** Ostacoli in campo. */
  obstacles?: Obstacle[];
  /** Respingenti da flipper in campo. */
  bumpers?: Bumper[];
  /** Zone di fango pesante. */
  mud?: MudZone[];
  /** Geyser periodici. */
  geysers?: Geyser[];
  /** Pendenza: accelerazione della palla a terra (px/s²) verso il basso del campo. */
  slope?: number;
  /** Onde che ogni tanto spazzano il campo e spingono la palla. */
  waves?: boolean;
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
  /**
   * Controllo di un solo giocatore (indice nella squadra, es. 4 = attaccante):
   * niente cambi, i compagni sono della CPU e PASSA senza palla chiede il pallone.
   */
  lockHuman?: number;
  /** Falli, cartellini e infortuni. */
  fouls?: boolean;
  /** Meteo (predefinito: sereno). */
  weather?: Weather;
  /** Partita in notturna con i riflettori. */
  night?: boolean;
  /** Modificatori arcade di regola per Sopravvivenza e Missioni speciali. */
  mods?: MatchMods;
  /** Modulo tattico delle squadre (predefinito: 1-2-1). */
  formation?: FormationId;
  awayFormation?: FormationId;
}

/** Modificatori arcade applicati dalla simulazione della partita. */
export interface MatchMods {
  /** Moltiplicatore velocità di tutti i giocatori (es. 1.2 = ritmo folle). */
  speedMult?: number;
  /** Moltiplicatore carica della barra SUPER (es. 2 = doppia carica). */
  superMult?: number;
  /** Moltiplicatore consumo fiato (0 = scatto infinito). */
  staminaMult?: number;
  /** Ogni tiro parte infuocato. */
  alwaysFire?: boolean;
  /** I power-up compaiono con frequenza doppia. */
  fastPowerUps?: boolean;
  /** Secondi iniziali di Muro davanti alla porta della squadra umana. */
  startWall?: number;
  /** Secondi iniziali di Turbo per la squadra umana. */
  startTurbo?: number;
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
  /** Esito dei calci di rigore, se ci sono stati. */
  penalties?: [number, number];
  scorers: { team: 0 | 1; name: string; time: number }[];
}
