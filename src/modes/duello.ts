/**
 * DUELLO A CARTE: modalità leggera a turni, senza grafica di partita.
 * Ogni giocatore della squadra è una carta con DRIBBLING e DIFESA. Si spende
 * energia per schierare le carte, che entrano in campo al turno dopo. Chi
 * svuota il campo avversario segna; vince chi arriva a 2 round.
 * Regole tutte nostre, ispirate (solo come idea) ai duelli a carte e a comandi.
 */
import type { PlayerDef, Role, TeamDef } from '../sim/types';
import { Rng } from '../sim/math';

export interface Card {
  id: string;
  name: string;
  role: Role;
  dribble: number;
  defense: number;
  cost: number;
  captain: boolean;
  /** Valori di partenza, per ripristinare la carta a ogni round. */
  base: { dribble: number; defense: number };
}

export interface Side {
  name: string;
  deck: Card[];
  bench: Card[];
  /** In campo: attaccano e difendono. */
  field: Card[];
  /** Appena schierate: entrano in campo all'inizio del prossimo turno. */
  pending: Card[];
  energy: number;
  /** Turni giocati in questo round (fa salire l'energia). */
  turns: number;
}

export type DuelEvent =
  | { kind: 'beat'; att: Card; def: Card }
  | { kind: 'stop'; att: Card; def: Card; out: boolean }
  | { kind: 'clash'; att: Card; def: Card }
  | { kind: 'goal'; side: 0 | 1 };

export interface DuelState {
  sides: [Side, Side];
  round: number;
  wins: [number, number];
  /** Di chi è il turno. */
  turn: 0 | 1;
  turnNo: number;
  over: boolean;
  /** Vincitore del duello (null = pareggio o in corso). */
  winner: 0 | 1 | null;
  rngSeed: number;
  log: string[];
}

export const MAX_FIELD = 4;
export const MAX_ROUNDS = 5;
export const WIN_ROUNDS = 2;
const TURN_CAP = 10;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const randInt = (r: Rng, a: number, b: number) => a + Math.floor(r.next() * (b - a + 1));

/** Dalla scheda del giocatore alla carta. */
export function cardOf(pd: PlayerDef, key: string): Card {
  const s = pd.stats;
  let dribble = 1 + (s.shot * 0.4 + s.control * 0.35 + s.speed * 0.25 - 0.5) * 7;
  let defense = 1 + (s.tackle * 0.5 + s.control * 0.25 + s.speed * 0.25 - 0.5) * 7;
  if (pd.role === 'FWD') dribble += 1;
  if (pd.role === 'DEF') defense += 1;
  if (pd.role === 'GK') {
    defense = 2 + (s.keeping - 0.5) * 7;
    dribble = 1;
  }
  const d = clamp(Math.round(dribble), 1, 8);
  const f = clamp(Math.round(defense), 1, 8);
  return {
    id: key,
    name: pd.name,
    role: pd.role,
    dribble: d,
    defense: f,
    cost: clamp(Math.round((d + f) / 5), 1, 4),
    captain: false,
    base: { dribble: d, defense: f },
  };
}

/** Mazzo di 8 carte: i 5 giocatori della squadra più 3 rinforzi dagli avversari più forti. */
export function buildDeck(team: TeamDef, others: TeamDef[], seed: number, tag: string): Card[] {
  const cards = team.players.map((p, i) => cardOf(p, `${tag}-${i}`));
  const pool = others
    .filter((t) => t.id !== team.id)
    .flatMap((t, ti) => t.players.map((p, i) => cardOf(p, `${tag}-x${ti}-${i}`)))
    .filter((c) => c.role !== 'GK')
    .sort((a, b) => b.dribble + b.defense - (a.dribble + a.defense));
  const rng = new Rng(seed);
  const top = pool.slice(0, 12);
  while (cards.length < 8 && top.length) cards.push(top.splice(randInt(rng, 0, top.length - 1), 1)[0]);
  // il capitano è la carta più forte: +1 dribbling e +1 difesa
  const cap = [...cards].sort((a, b) => b.dribble + b.defense - (a.dribble + a.defense))[0];
  cap.captain = true;
  cap.base = { dribble: cap.base.dribble + 1, defense: cap.base.defense + 1 };
  return cards;
}

function resetSide(s: Side) {
  s.bench = s.deck.map((c) => ({ ...c, dribble: c.base.dribble, defense: c.base.defense }));
  s.field = [];
  s.pending = [];
  s.turns = 0;
  s.energy = 0;
  // il capitano è già in campo a inizio round
  const i = s.bench.findIndex((c) => c.captain);
  if (i >= 0) s.field.push(s.bench.splice(i, 1)[0]);
}

export function newDuel(a: TeamDef, b: TeamDef, others: TeamDef[], seed: number): DuelState {
  const mk = (t: TeamDef, tag: string, sd: number): Side => ({
    name: t.name, deck: buildDeck(t, others, sd, tag), bench: [], field: [], pending: [], energy: 0, turns: 0,
  });
  const st: DuelState = {
    sides: [mk(a, 'a', seed + 1), mk(b, 'b', seed + 2)],
    round: 1, wins: [0, 0], turn: 0, turnNo: 1, over: false, winner: null, rngSeed: seed, log: [],
  };
  startRound(st, 0);
  return st;
}

function startRound(st: DuelState, first: 0 | 1) {
  for (const s of st.sides) resetSide(s);
  st.turn = first;
  st.turnNo = 1;
  beginTurn(st);
}

/** Inizio di un turno: le carte schierate entrano in campo e l'energia sale. */
function beginTurn(st: DuelState) {
  const s = st.sides[st.turn];
  s.field.push(...s.pending);
  s.pending = [];
  s.turns++;
  s.energy = Math.min(7, 2 + s.turns);
}

export function canPlace(st: DuelState, side: 0 | 1, c: Card): boolean {
  const s = st.sides[side];
  return !st.over && st.turn === side && s.energy >= c.cost && s.field.length + s.pending.length < MAX_FIELD && s.bench.includes(c);
}

export function place(st: DuelState, side: 0 | 1, id: string): boolean {
  const s = st.sides[side];
  const c = s.bench.find((x) => x.id === id);
  if (!c || !canPlace(st, side, c)) return false;
  s.bench.splice(s.bench.indexOf(c), 1);
  s.pending.push(c);
  s.energy -= c.cost;
  return true;
}

/** Contro chi attacca la carta numero i (l'ordine di schieramento conta). */
export function defenderFor(att: number, defenders: Card[]): Card | null {
  return defenders.length ? defenders[att % defenders.length] : null;
}

/** Fine turno: le carte in campo attaccano. Restituisce gli eventi per animarli. */
export function endTurn(st: DuelState): DuelEvent[] {
  const events: DuelEvent[] = [];
  const me = st.turn;
  const atk = st.sides[me];
  const dfs = st.sides[1 - me];
  // al primo turno di ogni squadra si schiera soltanto: niente vantaggio a chi batte per primo
  const attackers = atk.turns <= 1 ? [] : [...atk.field];
  for (let i = 0; i < attackers.length; i++) {
    const a = attackers[i];
    if (!atk.field.includes(a)) continue;
    const d = defenderFor(i, dfs.field);
    if (!d) break;
    if (a.dribble > d.defense) {
      dfs.field.splice(dfs.field.indexOf(d), 1);
      events.push({ kind: 'beat', att: a, def: d });
      st.log.push(`${a.name} salta ${d.name}`);
    } else if (a.dribble === d.defense) {
      a.dribble = Math.max(1, a.dribble - 1);
      d.defense = Math.max(1, d.defense - 1);
      events.push({ kind: 'clash', att: a, def: d });
      st.log.push(`${a.name} e ${d.name} si annullano`);
    } else {
      const out = d.defense - a.dribble >= 2;
      if (out) atk.field.splice(atk.field.indexOf(a), 1);
      else a.dribble = Math.max(1, a.dribble - 1);
      events.push({ kind: 'stop', att: a, def: d, out });
      st.log.push(`${d.name} ferma ${a.name}`);
    }
    if (!dfs.field.length) break;
  }
  if (attackers.length && !dfs.field.length && atk.field.length) {
    events.push({ kind: 'goal', side: me });
    st.log.push(`GOL di ${atk.name}!`);
    st.wins[me]++;
    finishRound(st, me);
    return events;
  }
  // turno all'altra squadra
  if (me === 1) st.turnNo++;
  if (!atk.field.length && !dfs.field.length && !atk.pending.length && !dfs.pending.length) {
    st.log.push('Nessuno in campo: round pari');
    finishRound(st, null);
    return events;
  }
  if (st.turnNo > TURN_CAP) {
    st.log.push('Tempo scaduto: round pari');
    finishRound(st, null);
    return events;
  }
  st.turn = (1 - me) as 0 | 1;
  beginTurn(st);
  return events;
}

function finishRound(st: DuelState, scorer: 0 | 1 | null) {
  const done = st.wins[0] >= WIN_ROUNDS || st.wins[1] >= WIN_ROUNDS || st.round >= MAX_ROUNDS;
  if (done) {
    st.over = true;
    st.winner = st.wins[0] === st.wins[1] ? null : st.wins[0] > st.wins[1] ? 0 : 1;
    return;
  }
  st.round++;
  // chi ha subito il gol batte per primo
  startRound(st, scorer === null ? ((st.round % 2) as 0 | 1) : ((1 - scorer) as 0 | 1));
}

/** Mossa della CPU: schiera le carte migliori, più difensori se è sotto pressione. */
export function cpuPlay(st: DuelState, side: 0 | 1, level: 'facile' | 'normale' | 'difficile') {
  const s = st.sides[side];
  const rng = new Rng(st.rngSeed + st.turnNo * 31 + side * 7 + st.round * 101);
  const enemy = st.sides[1 - side];
  const threat = enemy.field.reduce((n, c) => n + c.dribble, 0) / Math.max(1, s.field.length + s.pending.length);
  for (let guard = 0; guard < 6; guard++) {
    const options = s.bench.filter((c) => canPlace(st, side, c));
    if (!options.length) break;
    let pick: Card;
    if (level === 'facile') pick = options[randInt(rng, 0, options.length - 1)];
    else {
      const needDef = threat > 3.2 && level === 'difficile';
      const score = (c: Card) => ((needDef ? c.defense * 1.4 + c.dribble * 0.6 : c.dribble + c.defense) / c.cost) + rng.range(0, level === 'normale' ? 1.2 : 0.3);
      pick = [...options].sort((a, b) => score(b) - score(a))[0];
    }
    place(st, side, pick.id);
  }
}

/** Monete per il duello vinto. */
export function duelCoins(st: DuelState): number {
  if (st.winner !== 0) return st.winner === null ? 10 : 5;
  return 40 + (st.wins[0] - st.wins[1]) * 10;
}

export interface DuelloRecord {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
}

export function recordDuel(r: DuelloRecord | undefined, st: DuelState): DuelloRecord {
  const o = r ?? { played: 0, won: 0, streak: 0, bestStreak: 0 };
  o.played++;
  if (st.winner === 0) {
    o.won++;
    o.streak++;
    o.bestStreak = Math.max(o.bestStreak, o.streak);
  } else o.streak = 0;
  return o;
}
