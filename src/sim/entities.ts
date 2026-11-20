import type { PlayerDef, Role } from './types';

export type PlayerState = 'run' | 'slide' | 'stun' | 'kick' | 'dive' | 'volley' | 'bicycle' | 'celebrate' | 'sad';

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Direzione in radianti (0 = verso destra). */
  facing = 0;
  state: PlayerState = 'run';
  stateT = 0;
  /** Tempo di ricarica dopo un calcio (non può riprendere subito la palla). */
  kickCd = 0;
  tackleCd = 0;
  pickupCd = 0;
  stamina = 1;
  sprinting = false;
  /** Fase della corsa per l'animazione. */
  runPhase = 0;
  /** Bersaglio scelto dall'IA. */
  tx = 0;
  ty = 0;
  thinkT = 0;
  /** Da quanto tempo ha la palla. */
  holdT = 0;
  /** Velocità desiderata (input umano o IA), normalizzata 0..1. */
  wantX = 0;
  wantY = 0;
  wantSprint = false;
  /** Il portiere ha già provato la parata su questo tiro. */
  saveCd = 0;
  homeX = 0;
  homeY = 0;
  /** Riflessi del portiere: ritardo prima del tuffo. */
  reactT = 0;
  seenShot = false;
  /** Cartellini gialli in questa partita. */
  yellows = 0;
  /** Secondi di espulsione rimasti (fuori dal campo, poi rientra). */
  out = 0;
  /** Infortunato: corre più piano fino alla fine. */
  injured = false;
  /** Avversario che sta per essere saltato (per il dribbling "di stile"). */
  dribCand = -1;

  constructor(
    public readonly id: number,
    public readonly team: 0 | 1,
    public readonly idx: number,
    public readonly def: PlayerDef,
  ) {}

  get role(): Role {
    return this.def.role;
  }
  get isGK(): boolean {
    return this.def.role === 'GK';
  }
  get canAct(): boolean {
    return this.out <= 0 && (this.state === 'run' || this.state === 'kick');
  }
  setState(s: PlayerState, t = 0) {
    this.state = s;
    this.stateT = t;
  }
}

export class Ball {
  x = 0;
  y = 0;
  /** Altezza da terra. */
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  owner: Player | null = null;
  lastTouch: Player | null = null;
  /** Effetto (curva) in px/s² perpendicolare alla direzione. */
  spin = 0;
  fire = false;
  superShot = false;
  /** Pallone ingrandito (power-up Pallone Gigante): più pesante e rimbalzante. */
  giant = false;
  /** Il pallone è stato appena calciato verso la porta (per statistiche e parate). */
  isShot = false;
  /** Rotazione accumulata per l'animazione. */
  roll = 0;
  /** Da dove è partito l'ultimo tiro e se ha preso una sponda (per i gol "di stile"). */
  shotFrom: { x: number; y: number } | null = null;
  banked = false;
  /** Colpo aereo in corso (tiro al volo o rovesciata). */
  volley: 'volo' | 'rovesciata' | null = null;
  /** Destinatario di un passaggio in corso. */
  passTarget: Player | null = null;

  get speed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }
  stop() {
    this.vx = this.vy = this.vz = 0;
    this.spin = 0;
  }
}

export type PowerUpKind = 'fuoco' | 'turbo' | 'muro' | 'ghiaccio' | 'calamita' | 'gigante';

export interface PowerUp {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  /** Secondi rimasti prima che sparisca. */
  life: number;
}

export type SimEvent =
  | { type: 'kick'; x: number; y: number; power: number; team: 0 | 1 }
  | { type: 'shot'; x: number; y: number; power: number; team: 0 | 1; superShot: boolean; fire: boolean; idx?: number; volley?: 'volo' | 'rovesciata' }
  | { type: 'pass'; x: number; y: number; team: 0 | 1; idx?: number }
  | { type: 'goal'; team: 0 | 1; scorer: string; x: number; y: number; own: boolean; idx?: number; volley?: 'volo' | 'rovesciata' | null; banked?: boolean; long?: boolean; superGoal?: boolean }
  | { type: 'save'; x: number; y: number; catch: boolean; team: 0 | 1; idx?: number }
  | { type: 'post'; x: number; y: number }
  | { type: 'wall'; x: number; y: number; power: number }
  | { type: 'bumper'; x: number; y: number; power: number }
  | { type: 'geyser'; x: number; y: number }
  | { type: 'bounce'; x: number; y: number; power: number }
  | { type: 'tackle'; x: number; y: number; won: boolean; team: 0 | 1; idx?: number }
  | { type: 'slide'; x: number; y: number }
  | { type: 'steal'; x: number; y: number; team: 0 | 1; idx?: number }
  | { type: 'whistle'; kind: 'start' | 'end' | 'kickoff' | 'golden' }
  | { type: 'powerup'; kind: PowerUpKind; team: 0 | 1; x: number; y: number }
  | { type: 'powerupSpawn'; kind: PowerUpKind; x: number; y: number }
  | { type: 'superReady'; team: 0 | 1 }
  | { type: 'switch'; id: number }
  | { type: 'call'; id: number; x: number; y: number }
  | { type: 'wave'; dir: 1 | -1 }
  | { type: 'freekick'; team: 0 | 1; x: number; y: number; human: boolean }
  | { type: 'trick'; kind: TrickKind; team: 0 | 1; x: number; y: number; name: string; idx?: number }
  | { type: 'showtime'; team: 0 | 1 }
  | { type: 'foul'; x: number; y: number; team: 0 | 1; by: string; byIdx?: number; victim: string; card: 'none' | 'yellow' | 'red'; injury: boolean };

/** Giocate di stile: dribbling, tunnel, gol da lontano, gol di sponda, tiro al volo, rovesciata. */
export type TrickKind = 'dribbling' | 'tunnel' | 'lontano' | 'sponda' | 'volo' | 'rovesciata';
