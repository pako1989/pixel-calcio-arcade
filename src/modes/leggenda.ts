import { Rng } from '../sim/math';
import type { Role, TeamDef } from '../sim/types';

/**
 * Leggenda del Pallone: calcio in stile anime sportivo, a turni.
 * Quando chi porta palla incontra un avversario si sceglie l'azione (dribbling,
 * passaggio, tiro o una tecnica speciale): ogni scelta consuma energia.
 * Qui c'è solo la logica pura (nessuna grafica), così si può provare con i test.
 */

// ---------- personaggi ----------

export type HairStyle = 'punte' | 'ciuffo' | 'lunghi' | 'corti' | 'cresta' | 'raccolti' | 'brizzolati' | 'ricci' | 'rasati';

/** Aspetto del ritratto in stile anime. */
export interface Face {
  /** Indice nella palette della pelle (0..4). */
  skin: number;
  hair: number;
  style: HairStyle;
  eyes: number;
  /** Fascia sulla fronte. */
  band?: number;
  glasses?: boolean;
  scarf?: number;
  beard?: boolean;
  /** Sopracciglia: fiere (da protagonista) o tranquille. */
  brows?: 'fiero' | 'calmo';
  plaster?: boolean;
}

export interface LgPlayer {
  id: string;
  name: string;
  num: number;
  role: Role;
  /** Statistiche 1..10. */
  drb: number;
  pas: number;
  sht: number;
  tck: number;
  blk: number;
  gk: number;
  /** Energia massima. */
  sta: number;
  techs: string[];
  face: Face;
}

export interface LgTeam {
  id: string;
  name: string;
  short: string;
  colors: TeamDef['colors'];
  pattern: TeamDef['pattern'];
  /** 7 giocatori: portiere, 2 difensori, 2 centrocampisti, 2 attaccanti. */
  players: LgPlayer[];
}

// ---------- tecniche ----------

export type TechKind = 'tiro' | 'dribbling' | 'passaggio' | 'parata' | 'blocco';

export interface Technique {
  id: string;
  name: string;
  kind: TechKind;
  power: number;
  cost: number;
  /** Tiri: distanza (metri) entro cui il tiro non perde forza. */
  range?: number;
  /** Combo: serve anche questo compagno in campo, che spende la stessa energia. */
  partner?: string;
  color: number;
  desc: string;
  /** Come si impara (solo per la tua squadra). */
  unlock?: { ep: number; pts?: number };
}

export const TECHS: Record<string, Technique> = {
  // --- i tuoi ---
  gabbiano: { id: 'gabbiano', name: 'TIRO DEL GABBIANO', kind: 'tiro', power: 22, cost: 18, range: 32, color: 0x8fd8ff, desc: 'Sale e piomba sotto la traversa.', unlock: { ep: 1 } },
  vortice: { id: 'vortice', name: 'DRIBBLING VORTICE', kind: 'dribbling', power: 20, cost: 10, color: 0x5be3c0, desc: 'Giravolta: il difensore resta a vuoto.', unlock: { ep: 1, pts: 40 } },
  cometa: { id: 'cometa', name: 'BOLIDE COMETA', kind: 'tiro', power: 26, cost: 30, range: 100, color: 0xff8a2a, desc: 'Non perde forza: attraversa il campo.', unlock: { ep: 4, pts: 120 } },
  mezzaluna: { id: 'mezzaluna', name: 'DOPPIA MEZZALUNA', kind: 'dribbling', power: 32, cost: 12, partner: 'dario', color: 0xd8e0ff, desc: 'Combo: uno-due a mezzaluna con Dario.', unlock: { ep: 3 } },
  eclissi: { id: 'eclissi', name: 'TIRO ECLISSI', kind: 'tiro', power: 42, cost: 24, range: 40, partner: 'dario', color: 0xb07aff, desc: 'Combo: Nico e Dario calciano insieme.', unlock: { ep: 6, pts: 160 } },
  tempesta: { id: 'tempesta', name: 'TIRO TEMPESTA', kind: 'tiro', power: 46, cost: 26, range: 45, partner: 'sandro', color: 0x6a8aff, desc: 'Combo: vento e tuono in un colpo.', unlock: { ep: 7, pts: 200 } },
  aurora: { id: 'aurora', name: 'TIRO DELL\'AURORA', kind: 'tiro', power: 52, cost: 40, range: 60, color: 0xffd23f, desc: 'Il colpo finale: si accende come l\'alba.', unlock: { ep: 9 } },
  passoluna: { id: 'passoluna', name: 'PASSAGGIO LUNA', kind: 'passaggio', power: 24, cost: 8, color: 0xd8e0ff, desc: 'Parabola quasi impossibile da prendere.', unlock: { ep: 3 } },
  acciaio: { id: 'acciaio', name: 'MANI D\'ACCIAIO', kind: 'parata', power: 18, cost: 14, color: 0xc0c8d8, desc: 'Presa sicura sui tiri potenti.', unlock: { ep: 1 } },
  rondine: { id: 'rondine', name: 'TUFFO DELLA RONDINE', kind: 'parata', power: 30, cost: 22, color: 0x3fd0ff, desc: 'Tuffo lunghissimo da palo a palo.', unlock: { ep: 5, pts: 100 } },
  muraglia: { id: 'muraglia', name: 'MURAGLIA UMANA', kind: 'blocco', power: 22, cost: 12, color: 0xc4552e, desc: 'Gigi si lancia davanti al pallone.', unlock: { ep: 3, pts: 60 } },
  tuono: { id: 'tuono', name: 'TIRO TUONO', kind: 'tiro', power: 30, cost: 26, range: 45, color: 0xffe03a, desc: 'Un fulmine dal destro di Sandro.', unlock: { ep: 5 } },
  // --- degli avversari ---
  gattonero: { id: 'gattonero', name: 'PARATA DEL GATTO NERO', kind: 'parata', power: 24, cost: 18, color: 0x8a6aff, desc: '' },
  ondasalata: { id: 'ondasalata', name: 'ONDA SALATA', kind: 'dribbling', power: 20, cost: 10, color: 0x3fb8ff, desc: '' },
  serpente: { id: 'serpente', name: 'TIRO SERPENTE PIUMATO', kind: 'tiro', power: 26, cost: 22, range: 35, color: 0x5be37d, desc: '' },
  diga: { id: 'diga', name: 'LA DIGA', kind: 'parata', power: 34, cost: 20, color: 0xff8a2a, desc: '' },
  tango: { id: 'tango', name: 'TANGO FANTASMA', kind: 'dribbling', power: 26, cost: 12, color: 0x8fd8ff, desc: '' },
  pampero: { id: 'pampero', name: 'TIRO PAMPERO', kind: 'tiro', power: 30, cost: 24, range: 40, color: 0xd8e0ff, desc: '' },
  valanga: { id: 'valanga', name: 'VALANGA GEMELLA', kind: 'tiro', power: 38, cost: 24, range: 40, partner: 'even', color: 0xe8f4ff, desc: '' },
  ghiaccio: { id: 'ghiaccio', name: 'MURO DI GHIACCIO', kind: 'parata', power: 28, cost: 20, color: 0x8fd8ff, desc: '' },
  colibri: { id: 'colibri', name: 'DANZA DEL COLIBRÌ', kind: 'dribbling', power: 30, cost: 12, color: 0x5be37d, desc: '' },
  solare: { id: 'solare', name: 'TIRO SOLARE', kind: 'tiro', power: 38, cost: 28, range: 45, color: 0xffb21e, desc: '' },
  tucano: { id: 'tucano', name: 'ALA DEL TUCANO', kind: 'parata', power: 30, cost: 20, color: 0xffd23f, desc: '' },
};

/** Le tecniche della tua squadra, nell'ordine in cui compaiono nel libro delle tecniche. */
export const MY_TECHS = ['gabbiano', 'acciaio', 'vortice', 'muraglia', 'mezzaluna', 'passoluna', 'cometa', 'tuono', 'rondine', 'eclissi', 'tempesta', 'aurora'];

/** Chi usa la tecnica (nella tua squadra). */
export const TECH_OWNER: Record<string, string> = {
  gabbiano: 'nico', vortice: 'nico', cometa: 'nico', mezzaluna: 'nico', eclissi: 'nico', tempesta: 'nico', aurora: 'nico',
  passoluna: 'dario', acciaio: 'tommaso', rondine: 'tommaso', muraglia: 'gigi', tuono: 'sandro',
};

// ---------- salvataggio & campionato ----------

export interface ChampionshipTeam {
  id: string;
  name: string;
  short: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface ChampionshipMatch {
  id: string;
  homeId: string;
  awayId: string;
  homeScore?: number;
  awayScore?: number;
  played: boolean;
  round: number;
  stage: 'group' | 'semifinal' | 'final';
}

export interface ChampionshipState {
  active: boolean;
  stage: 'group' | 'semifinal' | 'final' | 'done';
  round: number;
  teams: ChampionshipTeam[];
  matches: ChampionshipMatch[];
  trophyWon: boolean;
}

export function newChampionshipState(): ChampionshipState {
  const teams: ChampionshipTeam[] = [
    { id: 'portobello', name: 'Portobello FC', short: 'PFC', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    { id: 'santelmo', name: 'Collegio Sant\'Elmo', short: 'SEL', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    { id: 'monteruvido', name: 'Monteruvido', short: 'MON', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    { id: 'saline', name: 'Accademia Saline', short: 'SAL', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
  ];
  const matches: ChampionshipMatch[] = [
    { id: 'g1_1', homeId: 'portobello', awayId: 'santelmo', played: false, round: 0, stage: 'group' },
    { id: 'g1_2', homeId: 'monteruvido', awayId: 'saline', played: false, round: 0, stage: 'group' },
    { id: 'g2_1', homeId: 'portobello', awayId: 'monteruvido', played: false, round: 1, stage: 'group' },
    { id: 'g2_2', homeId: 'santelmo', awayId: 'saline', played: false, round: 1, stage: 'group' },
    { id: 'g3_1', homeId: 'portobello', awayId: 'saline', played: false, round: 2, stage: 'group' },
    { id: 'g3_2', homeId: 'santelmo', awayId: 'monteruvido', played: false, round: 2, stage: 'group' },
  ];
  return {
    active: true,
    stage: 'group',
    round: 0,
    teams,
    matches,
    trophyWon: false,
  };
}

export function recordChampionshipMatch(st: ChampionshipState, matchId: string, hs: number, as: number): void {
  const m = st.matches.find((x) => x.id === matchId);
  if (!m || m.played) return;
  m.homeScore = hs;
  m.awayScore = as;
  m.played = true;

  const home = st.teams.find((t) => t.id === m.homeId);
  const away = st.teams.find((t) => t.id === m.awayId);
  if (home && away) {
    home.p++;
    away.p++;
    home.gf += hs;
    home.ga += as;
    away.gf += as;
    away.ga += hs;
    if (hs > as) {
      home.w++;
      home.pts += 3;
      away.l++;
    } else if (hs < as) {
      away.w++;
      away.pts += 3;
      home.l++;
    } else {
      home.d++;
      home.pts += 1;
      away.d++;
      away.pts += 1;
    }
  }

  if (m.stage === 'group') {
    const roundMatches = st.matches.filter((x) => x.stage === 'group' && x.round === st.round);
    if (roundMatches.every((x) => x.played)) {
      if (st.round < 2) {
        st.round++;
      } else {
        st.teams.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
        st.stage = 'final';
        st.matches.push({
          id: 'final_match',
          homeId: st.teams[0].id,
          awayId: st.teams[1].id,
          played: false,
          round: 3,
          stage: 'final',
        });
      }
    }
  } else if (m.stage === 'final') {
    st.stage = 'done';
    if (hs > as && m.homeId === 'portobello') {
      st.trophyWon = true;
    } else if (as > hs && m.awayId === 'portobello') {
      st.trophyWon = true;
    }
  }
}

export interface LeggendaSave {
  /** Episodi superati (0..EPISODES). */
  cleared: number;
  /** Punti Leggenda da spendere per imparare le tecniche. */
  pts: number;
  learned: string[];
  /** Allenamenti col Maestro di oggi. */
  trainDay: string;
  trainCount: number;
  /** Miglior allenamento. */
  trainBest: number;
  /** Gol segnati con le tecniche speciali (per i trofei). */
  specialGoals: number;
  championship?: ChampionshipState;
}

export function newLeggenda(): LeggendaSave {
  return { cleared: 0, pts: 0, learned: [], trainDay: '', trainCount: 0, trainBest: 0, specialGoals: 0, championship: newChampionshipState() };
}

/** Una tecnica è a disposizione se l'hai imparata (o se te la insegna la storia). */
export function knows(s: LeggendaSave, id: string): boolean {
  return s.learned.includes(id);
}

/** Si può imparare spendendo punti: episodio raggiunto e punti sufficienti. */
export function canLearn(s: LeggendaSave, id: string): boolean {
  const t = TECHS[id];
  if (!t.unlock?.pts || knows(s, id)) return false;
  return s.cleared >= t.unlock.ep && s.pts >= t.unlock.pts;
}

export function learn(s: LeggendaSave, id: string): boolean {
  if (!canLearn(s, id)) return false;
  s.pts -= TECHS[id].unlock!.pts!;
  s.learned.push(id);
  return true;
}

/** Allenamento: i primi tre al giorno danno punti pieni, poi pochi. */
export const TRAIN_FULL = 3;

export function trainingReward(s: LeggendaSave, score: number, day: string): number {
  if (s.trainDay !== day) {
    s.trainDay = day;
    s.trainCount = 0;
  }
  s.trainCount++;
  s.trainBest = Math.max(s.trainBest, score);
  const pts = s.trainCount <= TRAIN_FULL ? score : Math.floor(score / 4);
  s.pts += pts;
  return pts;
}

// ---------- la partita ----------

export type Side = 0 | 1;
export type DefKind = 'contrasto' | 'intercetto' | 'blocco';
export type KeeperKind = 'presa' | 'pugno';

export interface AttackAction {
  kind: 'avanza' | 'dribbling' | 'passaggio' | 'tiro';
  tech?: string;
  /** Passaggio: a chi. */
  to?: string;
}

export interface DefenseAction {
  kind: DefKind;
  tech?: string;
}

export interface KeeperAction {
  kind: KeeperKind;
  tech?: string;
}

/** Un passo da raccontare/animare. */
export type Step =
  | { t: 'duel'; kind: 'dribbling' | 'passaggio'; att: string; def: string; attTech?: string; defTech?: string; defKind: DefKind; win: boolean }
  | { t: 'pass'; from: string; to: string; x0: number; x1: number; tech?: string }
  | { t: 'block'; by: string; tech?: string; ok: boolean; x: number }
  | { t: 'keeper'; by: string; tech?: string; kind: KeeperKind; result: 'goal' | 'presa' | 'pugno' }
  | { t: 'turnover'; side: Side; carrier: string; x: number }
  | { t: 'rebound'; side: Side; carrier: string; x: number }
  | { t: 'goal'; side: Side; by: string; tech?: string };

export interface Encounter {
  def: LgPlayer;
  x: number;
}

export interface ShotInfo {
  by: string;
  side: Side;
  tech?: string;
  partner?: string;
  power: number;
  x0: number;
  steps: Step[];
  /** Fermato prima del portiere. */
  blocked: boolean;
}

export interface MatchOpts {
  minutes: number;
  /** Bonus ai tuoi duelli (aiuto per la difficoltà). */
  assist: number;
  /** Tecniche che la tua squadra può usare. */
  known: string[];
  /** Energia massima ridotta (infortunio): id -> fattore. */
  injured?: Record<string, number>;
  seed?: number;
}

/** Posizioni di difesa (metri dalla tua porta) di chi aspetta l'attacco avversario. */
const DEF_POS: Record<Side, Record<Exclude<Role, 'GK'>, [number, number]>> = {
  // tu difendi verso la porta a x=0
  0: { FWD: [46, 40], MID: [34, 29], DEF: [23, 19] },
  // loro difendono verso la porta a x=100
  1: { FWD: [54, 60], MID: [66, 71], DEF: [77, 81] },
};
const ENGAGE: Record<Exclude<Role, 'GK'>, number> = { FWD: 0.35, MID: 0.55, DEF: 0.8 };
/** Dove si arriva quando restano solo il portiere e la porta. */
export const SHOOT_ZONE = 16;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Probabilità che vinca chi attacca. */
export function winChance(att: number, def: number): number {
  return clamp(0.5 + (att - def) / 60, 0.08, 0.94);
}

export class EpicMatch {
  readonly teams: [LgTeam, LgTeam];
  readonly opts: MatchOpts;
  readonly rng: Rng;
  energy: Record<string, number> = {};
  maxEnergy: Record<string, number> = {};
  score: [number, number] = [0, 0];
  time = 0;
  half: 1 | 2 = 1;
  side: Side = 0;
  carrier = '';
  x = 50;
  /** Avversari superati in questa azione. */
  passed = new Set<string>();
  /** Chi è pronto a intervenire in questa azione (deciso a inizio azione). */
  engagers: { id: string; x: number }[] = [];
  /** Numero dell'azione (cambia a ogni cambio di possesso). */
  poss = 0;
  /** Statistiche per il racconto finale. */
  duelsWon = 0;
  specialGoals = 0;
  scorers: { side: Side; by: string; time: number; tech?: string }[] = [];
  /** Tecniche usate almeno una volta (per i commenti della storia). */
  used = new Set<string>();

  constructor(home: LgTeam, away: LgTeam, opts: MatchOpts) {
    this.teams = [home, away];
    this.opts = opts;
    this.rng = new Rng(opts.seed ?? Date.now());
    for (const t of this.teams) {
      for (const p of t.players) {
        const m = Math.round(p.sta * (opts.injured?.[p.id] ?? 1));
        this.maxEnergy[p.id] = m;
        this.energy[p.id] = m;
      }
    }
    this.kickoff(0);
  }

  // ---------- chi è chi ----------

  player(id: string): LgPlayer {
    for (const t of this.teams) {
      const p = t.players.find((q) => q.id === id);
      if (p) return p;
    }
    throw new Error(`giocatore ${id}`);
  }

  sideOf(id: string): Side {
    return this.teams[0].players.some((p) => p.id === id) ? 0 : 1;
  }

  keeper(side: Side): LgPlayer {
    return this.teams[side].players.find((p) => p.role === 'GK')!;
  }

  /** Distanza dalla porta che si attacca. */
  distance(x = this.x, side = this.side): number {
    return side === 0 ? 100 - x : x;
  }

  /** Coordinata a `d` metri dalla porta attaccata. */
  xAt(d: number, side = this.side): number {
    return side === 0 ? 100 - d : d;
  }

  ahead(px: number, side = this.side): boolean {
    return side === 0 ? px > this.x : px < this.x;
  }

  // ---------- energia ----------

  /** Fattore 0.6..1 in base all'energia rimasta. */
  ef(id: string): number {
    return 0.6 + 0.4 * (this.energy[id] / Math.max(1, this.maxEnergy[id]));
  }

  spend(id: string, n: number) {
    this.energy[id] = Math.max(0, this.energy[id] - n);
  }

  restore(id: string, n: number) {
    this.energy[id] = Math.min(this.maxEnergy[id], this.energy[id] + n);
  }

  /** La tecnica è usabile adesso da questo giocatore? */
  techReady(id: string, tech: string): boolean {
    const t = TECHS[tech];
    const p = this.player(id);
    if (!p.techs.includes(tech)) return false;
    if (this.sideOf(id) === 0 && !this.opts.known.includes(tech)) return false;
    if (this.energy[id] < t.cost) return false;
    if (t.partner) {
      const side = this.sideOf(id);
      const mate = this.teams[side].players.find((q) => q.id === t.partner);
      if (!mate || this.energy[mate.id] < t.cost) return false;
    }
    return true;
  }

  techsOf(id: string, kind: TechKind): string[] {
    return this.player(id).techs.filter((t) => TECHS[t].kind === kind && this.techReady(id, t));
  }

  private bonus(side: Side) {
    return side === 0 ? this.opts.assist : 0;
  }

  // ---------- azioni ----------

  kickoff(side: Side) {
    const fwd = this.teams[side].players.filter((p) => p.role === 'FWD');
    // nella tua squadra il calcio d'inizio lo batte il protagonista
    const who = fwd.find((p) => p.id === 'nico') ?? fwd[0];
    this.startPossession(side, who.id, 50);
  }

  startPossession(side: Side, carrier: string, x: number) {
    this.side = side;
    this.carrier = carrier;
    this.x = clamp(x, 4, 96);
    this.passed.clear();
    this.poss++;
    const defSide = (1 - side) as Side;
    const list: { id: string; x: number }[] = [];
    const roleIdx: Record<string, number> = {};
    for (const p of this.teams[defSide].players) {
      if (p.role === 'GK') continue;
      const r = p.role as Exclude<Role, 'GK'>;
      const i = (roleIdx[r] = (roleIdx[r] ?? -1) + 1);
      const px = DEF_POS[defSide][r][Math.min(1, i)];
      if (!this.ahead(px)) continue;
      // le stelle con le tecniche non si tirano mai indietro
      const p0 = p.techs.length ? 1 : ENGAGE[r];
      if (this.rng.chance(p0)) list.push({ id: p.id, x: px });
    }
    list.sort((a, b) => (side === 0 ? a.x - b.x : b.x - a.x));
    this.engagers = list;
  }

  /** Posizione di attesa (metri) di un giocatore della squadra che difende. */
  spotOf(id: string): number {
    const side = this.sideOf(id);
    const t = this.teams[side];
    const p = this.player(id);
    if (p.role === 'GK') return side === 0 ? 2 : 98;
    const r = p.role as Exclude<Role, 'GK'>;
    const i = t.players.filter((q) => q.role === r).indexOf(p);
    return DEF_POS[side][r][Math.min(1, i)];
  }

  /** Fin dove si corre quando davanti c'è solo il portiere. */
  shootSpot(): number {
    const z = this.xAt(SHOOT_ZONE);
    return this.side === 0 ? Math.max(this.x, z) : Math.min(this.x, z);
  }

  /** Il prossimo avversario che ti viene incontro (null: davanti c'è solo il portiere). */
  nextEncounter(): Encounter | null {
    for (const e of this.engagers) {
      if (this.passed.has(e.id) || !this.ahead(e.x)) continue;
      return { def: this.player(e.id), x: e.x };
    }
    return null;
  }

  /** Corre fino a `x`: il tempo passa. */
  advanceTo(x: number) {
    const dx = Math.abs(x - this.x);
    this.x = x;
    this.tick(dx / 25);
  }

  tick(min: number) {
    this.time += min;
  }

  /** Compagni a cui passare: posizione in cui riceverebbero il pallone. */
  passTargets(): { id: string; x: number }[] {
    const mates = this.teams[this.side].players.filter((p) => p.id !== this.carrier && p.role !== 'GK');
    const fwd = this.side === 0 ? 1 : -1;
    return mates
      .map((p) => {
        const d = p.role === 'FWD' ? 18 : p.role === 'MID' ? 10 : -12;
        const x = clamp(this.x + d * fwd, 6, 94);
        const lim = this.xAt(SHOOT_ZONE);
        return { id: p.id, x: this.side === 0 ? Math.min(x, lim) : Math.max(x, lim) };
      })
      .filter((t) => (this.side === 0 ? t.x > this.x : t.x < this.x))
      .sort((a, b) => this.distance(a.x) - this.distance(b.x));
  }

  /** Valore di attacco di un giocatore per un tipo di giocata. */
  private attValue(id: string, kind: 'dribbling' | 'passaggio', tech?: string) {
    const p = this.player(id);
    const base = (kind === 'dribbling' ? p.drb : p.pas) * 10 * this.ef(id);
    return base + (tech ? TECHS[tech].power : 0) + this.bonus(this.sideOf(id));
  }

  private defValue(id: string, kind: DefKind, tech?: string) {
    const p = this.player(id);
    const s = kind === 'contrasto' ? p.tck : kind === 'intercetto' ? (p.tck + p.blk) / 2 : p.blk;
    return s * 10 * this.ef(id) + (tech ? TECHS[tech].power : 0) + this.bonus(this.sideOf(id));
  }

  private payTech(id: string, tech?: string) {
    if (!tech) return;
    const t = TECHS[tech];
    this.spend(id, t.cost);
    if (t.partner) {
      const mate = this.teams[this.sideOf(id)].players.find((q) => q.id === t.partner);
      if (mate) this.spend(mate.id, t.cost);
    }
    this.used.add(tech);
  }

  /** Dribbling o passaggio contro l'avversario incontrato. */
  duel(att: AttackAction, enc: Encounter | null, def: DefenseAction): Step[] {
    const steps: Step[] = [];
    const a = this.carrier;
    const kind = att.kind === 'passaggio' ? 'passaggio' : 'dribbling';
    this.spend(a, kind === 'dribbling' ? 4 : 3);
    this.payTech(a, att.tech);
    this.tick(kind === 'dribbling' ? 0.7 : 0.4);
    if (kind === 'passaggio') {
      const tg = this.passTargets().find((t) => t.id === att.to) ?? this.passTargets()[0];
      if (!tg) return steps;
      // chi prova a intercettare: l'avversario incontrato o uno tra te e il compagno
      let cut: Encounter | null = enc;
      if (!cut) {
        const between = this.engagers.find((e) => !this.passed.has(e.id) && this.ahead(e.x) && this.distance(e.x) >= this.distance(tg.x));
        if (between && this.rng.chance(0.5)) cut = { def: this.player(between.id), x: between.x };
      }
      let win = true;
      if (cut) {
        const d = cut.def.id;
        this.spend(d, 3);
        this.payTech(d, def.tech);
        const match = def.kind === 'intercetto';
        const dv = this.defValue(d, 'intercetto', def.tech) + (match ? 15 : -15);
        win = this.rng.chance(winChance(this.attValue(a, 'passaggio', att.tech), dv));
        steps.push({ t: 'duel', kind, att: a, def: d, attTech: att.tech, defTech: def.tech, defKind: def.kind, win });
        if (!win) {
          if (this.sideOf(a) === 1) this.duelsWon++;
          this.startPossession(this.sideOf(d), d, cut.x);
          steps.push({ t: 'turnover', side: this.side, carrier: d, x: this.x });
          return steps;
        }
        if (this.sideOf(a) === 0) this.duelsWon++;
      }
      steps.push({ t: 'pass', from: a, to: tg.id, x0: this.x, x1: tg.x, tech: att.tech });
      // gli avversari tra te e il compagno sono saltati
      for (const e of this.engagers) if (this.distance(e.x) >= this.distance(tg.x)) this.passed.add(e.id);
      this.carrier = tg.id;
      this.x = tg.x;
      return steps;
    }
    // dribbling
    if (!enc) return steps;
    const d = enc.def.id;
    this.spend(d, 4);
    this.payTech(d, def.tech);
    const match = def.kind === 'contrasto';
    const dv = this.defValue(d, 'contrasto', def.tech) + (match ? 15 : -15);
    const win = this.rng.chance(winChance(this.attValue(a, 'dribbling', att.tech), dv));
    steps.push({ t: 'duel', kind, att: a, def: d, attTech: att.tech, defTech: def.tech, defKind: def.kind, win });
    if (win) {
      this.passed.add(d);
      if (this.sideOf(a) === 0) this.duelsWon++;
      this.x = enc.x;
    } else {
      if (this.sideOf(a) === 1) this.duelsWon++;
      this.startPossession(this.sideOf(d), d, enc.x);
      steps.push({ t: 'turnover', side: this.side, carrier: d, x: this.x });
    }
    return steps;
  }

  /** Potenza di un tiro da qui. */
  shotPower(id: string, tech?: string, rand = this.rng.range(0, 20)): number {
    const p = this.player(id);
    const t = tech ? TECHS[tech] : undefined;
    const range = t?.range ?? 22;
    const d = this.distance();
    const pen = Math.max(0, d - range) * 1.4;
    return p.sht * 10 * this.ef(id) + (t?.power ?? 0) + rand - pen + this.bonus(this.sideOf(id));
  }

  /** Tiro: tentativi di respinta dei difensori, poi tocca al portiere (vedi `save`). */
  shoot(att: AttackAction, enc: Encounter | null, def: DefenseAction | null): ShotInfo {
    const by = this.carrier;
    const side = this.side;
    this.spend(by, 8);
    const power0 = this.shotPower(by, att.tech);
    this.payTech(by, att.tech);
    this.tick(0.8);
    const info: ShotInfo = { by, side, tech: att.tech, partner: att.tech ? TECHS[att.tech].partner : undefined, power: power0, x0: this.x, steps: [], blocked: false };
    // chi prova a mettersi in mezzo
    const tries: { id: string; bonus: number; tech?: string }[] = [];
    if (enc) tries.push({ id: enc.def.id, bonus: def?.kind === 'blocco' ? 15 : -15, tech: def?.tech });
    for (const e of this.engagers) {
      if (tries.length >= 2) break;
      if (this.passed.has(e.id) || !this.ahead(e.x) || tries.some((q) => q.id === e.id)) continue;
      if (this.rng.chance(0.35)) {
        const auto = this.techsOf(e.id, 'blocco')[0];
        tries.push({ id: e.id, bonus: 0, tech: auto && this.rng.chance(0.6) ? auto : undefined });
      }
    }
    for (const tr of tries) {
      this.spend(tr.id, att.tech ? 10 : 5);
      this.payTech(tr.id, tr.tech);
      const dv = this.defValue(tr.id, 'blocco', tr.tech) + tr.bonus;
      const ok = !this.rng.chance(winChance(info.power, dv));
      const ex = this.engagers.find((e) => e.id === tr.id)?.x ?? this.x;
      info.steps.push({ t: 'block', by: tr.id, tech: tr.tech, ok, x: ex });
      if (ok) {
        info.blocked = true;
        if (this.sideOf(tr.id) === 0) this.duelsWon++;
        // palla vagante: di solito la prende chi difende
        if (this.rng.chance(0.7)) {
          this.startPossession(this.sideOf(tr.id), tr.id, ex);
          info.steps.push({ t: 'turnover', side: this.side, carrier: tr.id, x: this.x });
        } else {
          this.startPossession(side, by, ex);
          info.steps.push({ t: 'rebound', side, carrier: by, x: this.x });
        }
        return info;
      }
      // anche se non lo ferma, il pallone perde forza
      info.power -= 6;
    }
    return info;
  }

  /** Scelta del portiere della CPU. */
  aiKeeper(shot: ShotInfo): KeeperAction {
    const gk = this.keeper((1 - shot.side) as Side);
    const tech = this.techsOf(gk.id, 'parata')[0];
    const useTech = tech && (shot.tech || shot.power > 85 || this.rng.chance(0.25));
    return { kind: shot.power > 85 ? 'pugno' : 'presa', tech: useTech ? tech : undefined };
  }

  /** Il portiere prova a fermare il tiro. */
  save(shot: ShotInfo, ka: KeeperAction): Step[] {
    const steps: Step[] = [];
    const defSide = (1 - shot.side) as Side;
    const gk = this.keeper(defSide);
    this.spend(gk.id, 3 + (shot.tech ? 8 : 0));
    const sv = gk.gk * 8.5 * this.ef(gk.id) + (ka.tech ? TECHS[ka.tech].power : 0) + this.rng.range(0, 20) + (ka.kind === 'pugno' ? 8 : 0) + this.bonus(defSide);
    this.payTech(gk.id, ka.tech);
    if (shot.power > sv) {
      steps.push({ t: 'keeper', by: gk.id, tech: ka.tech, kind: ka.kind, result: 'goal' });
      steps.push({ t: 'goal', side: shot.side, by: shot.by, tech: shot.tech });
      this.score[shot.side]++;
      this.scorers.push({ side: shot.side, by: shot.by, time: Math.floor(this.time), tech: shot.tech });
      if (shot.tech && shot.side === 0) this.specialGoals++;
      this.kickoff(defSide);
      return steps;
    }
    if (defSide === 0) this.duelsWon++;
    steps.push({ t: 'keeper', by: gk.id, tech: ka.tech, kind: ka.kind, result: ka.kind });
    if (ka.kind === 'pugno' && this.rng.chance(0.4)) {
      // respinta: la palla torna a chi ha tirato, poco fuori area
      const fwd = this.teams[shot.side].players.filter((p) => p.role !== 'GK' && p.id !== shot.by);
      const who = this.rng.chance(0.5) ? shot.by : this.rng.pick(fwd).id;
      this.startPossession(shot.side, who, this.xAt(SHOOT_ZONE + 6, shot.side));
      steps.push({ t: 'rebound', side: shot.side, carrier: who, x: this.x });
    } else {
      // il portiere rilancia a un compagno
      const mids = this.teams[defSide].players.filter((p) => p.role === 'MID' || p.role === 'FWD');
      const who = this.rng.pick(mids);
      this.startPossession(defSide, who.id, defSide === 0 ? 35 : 65);
      steps.push({ t: 'turnover', side: defSide, carrier: who.id, x: this.x });
    }
    return steps;
  }

  // ---------- intelligenza della CPU ----------

  /** Cosa fa la CPU quando difende contro il tuo attacco. */
  aiDefense(enc: Encounter): DefenseAction {
    const d = this.distance();
    const r = this.rng.next();
    const kind: DefKind = d < 30 ? (r < 0.45 ? 'blocco' : r < 0.78 ? 'contrasto' : 'intercetto') : r < 0.55 ? 'contrasto' : r < 0.9 ? 'intercetto' : 'blocco';
    const techs = this.techsOf(enc.def.id, kind === 'blocco' ? 'blocco' : 'dribbling').filter((t) => TECHS[t].kind === 'blocco');
    return { kind, tech: techs[0] && this.rng.chance(0.6) ? techs[0] : undefined };
  }

  /** Cosa fa la CPU quando attacca (enc = il tuo giocatore che le va incontro, null = solo il portiere). */
  aiAttack(enc: Encounter | null): AttackAction {
    const c = this.carrier;
    const d = this.distance();
    const shots = this.techsOf(c, 'tiro').filter((t) => d <= (TECHS[t].range ?? 22) + 6);
    if (!enc) return { kind: 'tiro', tech: shots[0] };
    if (shots.length && this.rng.chance(0.7)) return { kind: 'tiro', tech: shots[0] };
    const drb = this.techsOf(c, 'dribbling')[0];
    const pass = this.passTargets();
    const r = this.rng.next();
    if (d < 26 && r < 0.5) return { kind: 'tiro' };
    if (pass.length && r > 0.6) {
      const tg = pass.find((p) => this.player(p.id).techs.some((t) => TECHS[t].kind === 'tiro')) ?? pass[0];
      return { kind: 'passaggio', to: tg.id };
    }
    return { kind: 'dribbling', tech: drb && this.rng.chance(0.6) ? drb : undefined };
  }

  /** Indizio (non sempre giusto) su cosa farà la CPU. */
  hint<T extends string>(truth: T, all: readonly T[], reliability = 0.7): T {
    if (this.rng.chance(reliability)) return truth;
    const others = all.filter((k) => k !== truth);
    return this.rng.pick(others);
  }

  // ---------- tempo ----------

  get duration() {
    return this.opts.minutes;
  }

  /** Fine del primo tempo? (una volta sola) */
  checkHalf(): boolean {
    if (this.half === 1 && this.time >= this.duration / 2) {
      this.half = 2;
      this.time = this.duration / 2;
      for (const id of Object.keys(this.energy)) this.restore(id, Math.round(this.maxEnergy[id] * 0.3));
      this.kickoff(1);
      return true;
    }
    return false;
  }

  /** Minuto mostrato sul tabellone (0..90). */
  get clock(): number {
    return Math.min(90, Math.floor((this.time / this.duration) * 90));
  }

  get over() {
    return this.time >= this.duration;
  }
}

// ---------- obiettivi e premi ----------

export type Objective = { kind: 'vinci' } | { kind: 'nonperdere' } | { kind: 'segna'; n: number };

export function objectiveText(o: Objective): string {
  if (o.kind === 'vinci') return 'Vinci la partita';
  if (o.kind === 'nonperdere') return 'Non perdere';
  return o.n === 1 ? 'Segna almeno un gol' : `Segna almeno ${o.n} gol`;
}

export function objectiveMet(o: Objective, score: [number, number]): boolean {
  if (o.kind === 'vinci') return score[0] > score[1];
  if (o.kind === 'nonperdere') return score[0] >= score[1];
  return score[0] >= o.n;
}

export interface EpisodeReward {
  coins: number;
  pts: number;
  first: boolean;
}

/** Premi a fine episodio: monete per il negozio e Punti Leggenda. */
export function episodeReward(s: LeggendaSave, ep: number, ok: boolean, m: { duelsWon: number; score: [number, number]; specialGoals: number }): EpisodeReward {
  const first = ok && s.cleared === ep;
  const pts = m.duelsWon * 2 + m.score[0] * 8 + m.specialGoals * 6 + (ok ? (first ? 50 : 20) : 0);
  const coins = ok ? (first ? 80 + ep * 15 : 30) + m.score[0] * 5 : 10;
  s.pts += pts;
  s.specialGoals += m.specialGoals;
  if (first) s.cleared = ep + 1;
  return { coins, pts, first };
}
