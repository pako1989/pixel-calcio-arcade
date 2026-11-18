/**
 * Modalità MANAGER: guidi un club di quartiere stagione dopo stagione, dalla
 * Lega di Quartiere fino alla Serie Pixel. Rosa con età, morale ed energia,
 * mercato, allenamento, finanze, classifica e calendario. Ogni partita si può
 * giocare in arcade (con le statistiche vere della rosa) o simulare.
 *
 * Qui c'è solo la logica pura (niente Phaser): si può provare nei test.
 */
import { MatchSim } from '../sim/match';
import { clamp, Rng } from '../sim/math';
import type { Difficulty, MatchResult, PitchId, PlayerDef, PlayerStats, Role, TeamDef } from '../sim/types';
import { makePlayers, type TeamSeed } from '../data/teams';
import { PITCHES } from '../data/pitches';
import { randomConditions } from '../data/weather';

// ---------------------------------------------------------------- costanti

export const DIVISIONS = [
  { name: 'LEGA DI QUARTIERE', short: 'Quartiere', sponsor: 2500, ticket: 5, prize: 10000, pitch: 'quartiere' as PitchId },
  { name: 'LEGA CITTADINA', short: 'Città', sponsor: 5000, ticket: 8, prize: 20000, pitch: 'tetto' as PitchId },
  { name: 'LEGA REGIONALE', short: 'Regione', sponsor: 8500, ticket: 12, prize: 40000, pitch: 'spiaggia' as PitchId },
  { name: 'SERIE PIXEL', short: 'Serie Pixel', sponsor: 14000, ticket: 18, prize: 90000, pitch: 'stadio' as PitchId },
];
export const TOP_DIVISION = DIVISIONS.length - 1;

/** Livello (come le "stelle" delle squadre) dei club di ogni divisione. */
const DIV_LEVEL: [number, number][] = [
  [0.2, 1.3],
  [1.1, 2.3],
  [2.1, 3.4],
  [3.2, 4.7],
];

export const MAX_SQUAD = 10;
export const MIN_SQUAD = 6;
/** Durata (secondi di gioco) delle partite simulate. */
export const SIM_DURATION = 150;

export type FormationId = 'rombo' | 'muro' | 'tridente' | 'quadrato';
/** Ruolo di ogni posto (1..4; lo 0 è sempre il portiere). Posto 1 = centrale dietro, 2-3 = ali, 4 = punta. */
export const FORMATIONS: Record<FormationId, { name: string; desc: string; roles: Role[] }> = {
  rombo: { name: '1-2-1 ROMBO', desc: 'Equilibrata: un difensore, due centrocampisti, una punta.', roles: ['GK', 'DEF', 'MID', 'MID', 'FWD'] },
  muro: { name: '2-1-1 MURO', desc: 'Prudente: due difensori, si rischia poco.', roles: ['GK', 'DEF', 'DEF', 'MID', 'FWD'] },
  tridente: { name: '1-1-2 TRIDENTE', desc: 'Offensiva: due punte, più gol fatti e subiti.', roles: ['GK', 'DEF', 'MID', 'FWD', 'FWD'] },
  quadrato: { name: '2-0-2 QUADRATO', desc: 'Tutto o niente: due dietro, due davanti.', roles: ['GK', 'DEF', 'DEF', 'FWD', 'FWD'] },
};
export const FORMATION_ORDER: FormationId[] = ['rombo', 'muro', 'tridente', 'quadrato'];

export type TrainingId = 'attacco' | 'difesa' | 'tecnica' | 'fisico' | 'riposo';
export const TRAININGS: Record<TrainingId, { name: string; desc: string; stats: (keyof PlayerStats)[] }> = {
  attacco: { name: 'ATTACCO', desc: 'Tiro e controllo palla.', stats: ['shot', 'control'] },
  difesa: { name: 'DIFESA', desc: 'Contrasti e parate.', stats: ['tackle', 'keeping'] },
  tecnica: { name: 'TECNICA', desc: 'Passaggi e controllo.', stats: ['pass', 'control'] },
  fisico: { name: 'FISICO', desc: 'Velocità e contrasti.', stats: ['speed', 'tackle'] },
  riposo: { name: 'RIPOSO', desc: 'Niente progressi, ma energia e morale salgono.', stats: [] },
};
export const TRAINING_ORDER: TrainingId[] = ['attacco', 'difesa', 'tecnica', 'fisico', 'riposo'];

export const STADIUM_LEVELS = [
  { name: 'Campetto', seats: 300 },
  { name: 'Tribunetta', seats: 900 },
  { name: 'Stadio comunale', seats: 2500 },
  { name: 'Arena Pixel', seats: 7000 },
];
export const STADIUM_COST = [25000, 70000, 180000];
export const TRAINING_LEVELS = ['Prato del parco', 'Campo d\'allenamento', 'Centro sportivo', 'Cittadella Pixel'];
export const TRAINING_COST = [18000, 50000, 130000];

export const STAT_KEYS: (keyof PlayerStats)[] = ['speed', 'shot', 'pass', 'control', 'tackle', 'keeping'];
export const STAT_LABEL: Record<keyof PlayerStats, string> = {
  speed: 'VELOCITÀ',
  shot: 'TIRO',
  pass: 'PASSAGGIO',
  control: 'CONTROLLO',
  tackle: 'CONTRASTO',
  keeping: 'PARATE',
};
export const ROLE_LABEL: Record<Role, string> = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' };

const SURNAMES = [
  'Rossi', 'Esposito', 'Bianchi', 'Ferri', 'Greco', 'Conte', 'Marino', 'Gallo', 'Costa', 'Fontana',
  'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Caruso', 'Ricci', 'Leone', 'Serra', 'Villa', 'Testa',
  'Fabbri', 'Mancini', 'De Luca', 'Romano', 'Santoro', 'Martini', 'Longo', 'Gentile', 'Pace', 'Vitale',
  'Orlando', 'Sala', 'Galli', 'Riva', 'Neri', 'Bruno', 'Grasso', 'Monti', 'Parisi', 'Fiore',
  'Amato', 'Bellini', 'Cirillo', 'D\'Angelo', 'Ferraro', 'Giordano', 'Iorio', 'Lupo', 'Messina', 'Nardi',
  'Olivieri', 'Palumbo', 'Quaranta', 'Rinaldi', 'Sorrentino', 'Tedesco', 'Valente', 'Zanetti', 'Basile', 'Coppola',
  'Donati', 'Farina', 'Guerra', 'Marchetti', 'Pellegrini', 'Russo', 'Silvestri', 'Torre', 'Vacca', 'Bassi',
];

/** Club avversari di ogni divisione (nomi originali). */
const CLUB_SEEDS: TeamSeed[][] = [
  [
    { id: 'm_ortica', name: 'Ortica United', short: 'ORT', colors: { shirt: 0x5a9e2f, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0x5a9e2f, gk: 0xff7a1a }, pattern: 'plain', stars: 1 },
    { id: 'm_lavatoio', name: 'Real Lavatoio', short: 'LAV', colors: { shirt: 0x2a9fd6, shirt2: 0xffffff, shorts: 0xffffff, socks: 0x2a9fd6, gk: 0xf5c400 }, pattern: 'hoops', stars: 1 },
    { id: 'm_ferrovieri', name: 'Ferrovieri', short: 'FER', colors: { shirt: 0x7a2a2a, shirt2: 0xd8d8d8, shorts: 0x2b2b2b, socks: 0x7a2a2a, gk: 0x29c7c7 }, pattern: 'stripes', stars: 1 },
    { id: 'm_cortile', name: 'Atletico Cortile', short: 'COR', colors: { shirt: 0xe04040, shirt2: 0xffffff, shorts: 0x1d3f8f, socks: 0xe04040, gk: 0x9bd12a }, pattern: 'stripes', stars: 1 },
    { id: 'm_panettieri', name: 'Panettieri', short: 'PAN', colors: { shirt: 0xe8d8a8, shirt2: 0x8a5a2a, shorts: 0x8a5a2a, socks: 0xe8d8a8, gk: 0x3a7bff }, pattern: 'sash', stars: 1 },
    { id: 'm_mercato', name: 'Sporting Mercato', short: 'MER', colors: { shirt: 0xff9a1a, shirt2: 0x1a1a1a, shorts: 0xff9a1a, socks: 0x1a1a1a, gk: 0x7d5cff }, pattern: 'half', stars: 1 },
    { id: 'm_campanile', name: 'Campanile', short: 'CAM', colors: { shirt: 0x8a8fb0, shirt2: 0x1d3f8f, shorts: 0x1d3f8f, socks: 0x8a8fb0, gk: 0xe0457b }, pattern: 'plain', stars: 1 },
  ],
  [
    { id: 'm_tramvieri', name: 'Tramvieri', short: 'TRA', colors: { shirt: 0xf5c400, shirt2: 0x1d3f8f, shorts: 0x1d3f8f, socks: 0xf5c400, gk: 0xe04040 }, pattern: 'half', stars: 2 },
    { id: 'm_fontana', name: 'Fontana Rossa', short: 'FON', colors: { shirt: 0xc8202a, shirt2: 0xffffff, shorts: 0xffffff, socks: 0xc8202a, gk: 0x2fbf5a }, pattern: 'hoops', stars: 2 },
    { id: 'm_ponte', name: 'Ponte Vecchio FC', short: 'PON', colors: { shirt: 0x4a3a8a, shirt2: 0xf5c400, shorts: 0x1a1a1a, socks: 0x4a3a8a, gk: 0xff7a1a }, pattern: 'sash', stars: 2 },
    { id: 'm_universita', name: 'Universitaria', short: 'UNI', colors: { shirt: 0x1a1a1a, shirt2: 0xf5c400, shorts: 0x1a1a1a, socks: 0xf5c400, gk: 0x3fd0ff }, pattern: 'stripes', stars: 2 },
    { id: 'm_officine', name: 'Officine', short: 'OFF', colors: { shirt: 0x5a6a7a, shirt2: 0xff6a00, shorts: 0x5a6a7a, socks: 0xff6a00, gk: 0x9bd12a }, pattern: 'plain', stars: 2 },
    { id: 'm_giardini', name: 'Giardini', short: 'GIA', colors: { shirt: 0x2fbf5a, shirt2: 0xffffff, shorts: 0xffffff, socks: 0x2fbf5a, gk: 0xe0457b }, pattern: 'stripes', stars: 2 },
    { id: 'm_castello', name: 'Castello', short: 'CAS', colors: { shirt: 0xd8d8d8, shirt2: 0x7a2a2a, shorts: 0x7a2a2a, socks: 0xd8d8d8, gk: 0xf5c400 }, pattern: 'sash', stars: 2 },
  ],
  [
    { id: 'm_marina', name: 'Marina Azzurra', short: 'MAR', colors: { shirt: 0x2a9fd6, shirt2: 0x1d3f8f, shorts: 0x1d3f8f, socks: 0x2a9fd6, gk: 0xff7a1a }, pattern: 'stripes', stars: 3 },
    { id: 'm_collina', name: 'Collina Verde', short: 'COL', colors: { shirt: 0x1f9e4a, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0x1f9e4a, gk: 0xf5c400 }, pattern: 'half', stars: 3 },
    { id: 'm_vulcano', name: 'Vulcano', short: 'VUL', colors: { shirt: 0x8a1018, shirt2: 0xff6a00, shorts: 0x1a1a1a, socks: 0x8a1018, gk: 0x29c7c7 }, pattern: 'hoops', stars: 3 },
    { id: 'm_saline', name: 'Saline', short: 'SAL', colors: { shirt: 0xffffff, shirt2: 0xff5a5a, shorts: 0xff5a5a, socks: 0xffffff, gk: 0x1d3f8f }, pattern: 'sash', stars: 3 },
    { id: 'm_altopiano', name: 'Altopiano', short: 'ALT', colors: { shirt: 0x8a5a2a, shirt2: 0xf5c400, shorts: 0xf5c400, socks: 0x8a5a2a, gk: 0x7d5cff }, pattern: 'plain', stars: 3 },
    { id: 'm_faro', name: 'Faro', short: 'FAR', colors: { shirt: 0xf5c400, shirt2: 0xc8202a, shorts: 0xc8202a, socks: 0xf5c400, gk: 0x2fbf5a }, pattern: 'hoops', stars: 3 },
    { id: 'm_valle', name: 'Valle d\'Oro', short: 'VAL', colors: { shirt: 0x6a2bbf, shirt2: 0xf5c400, shorts: 0x6a2bbf, socks: 0xf5c400, gk: 0xff7a1a }, pattern: 'stripes', stars: 3 },
  ],
  [
    { id: 'm_corona', name: 'Corona Reale', short: 'CRN', colors: { shirt: 0xffd23f, shirt2: 0x6a2bbf, shorts: 0x6a2bbf, socks: 0xffd23f, gk: 0x2fbf5a }, pattern: 'plain', stars: 5 },
    { id: 'm_fulmine', name: 'Fulmine', short: 'FUL', colors: { shirt: 0x1a1a1a, shirt2: 0x3fd0ff, shorts: 0x1a1a1a, socks: 0x3fd0ff, gk: 0xff7a1a }, pattern: 'stripes', stars: 5 },
    { id: 'm_leoni', name: 'Leoni d\'Argento', short: 'LEO', colors: { shirt: 0xd8d8d8, shirt2: 0x1d3f8f, shorts: 0x1d3f8f, socks: 0xd8d8d8, gk: 0xe04040 }, pattern: 'sash', stars: 4 },
    { id: 'm_stella', name: 'Stella Polare', short: 'STE', colors: { shirt: 0x1d3f8f, shirt2: 0xffffff, shorts: 0xffffff, socks: 0x1d3f8f, gk: 0xf5c400 }, pattern: 'hoops', stars: 4 },
    { id: 'm_tempesta', name: 'Tempesta', short: 'TEM', colors: { shirt: 0x5a6a7a, shirt2: 0xf5c400, shorts: 0x1a1a1a, socks: 0x5a6a7a, gk: 0xe0457b }, pattern: 'half', stars: 4 },
    { id: 'm_drago', name: 'Drago Rosso', short: 'DRG', colors: { shirt: 0xc8202a, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0xc8202a, gk: 0x9bd12a }, pattern: 'stripes', stars: 4 },
    { id: 'm_aurora', name: 'Aurora', short: 'AUR', colors: { shirt: 0xff7ab8, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0xff7ab8, gk: 0x3fd0ff }, pattern: 'plain', stars: 4 },
  ],
];

/** Colori tra cui scegliere per il proprio club. */
export const CLUB_KITS: { colors: TeamDef['colors']; pattern: TeamDef['pattern'] }[] = [
  { colors: { shirt: 0xe8443a, shirt2: 0xffd23f, shorts: 0x1a1a1a, socks: 0xe8443a, gk: 0x3fd0ff }, pattern: 'half' },
  { colors: { shirt: 0x2f6fd0, shirt2: 0xffffff, shorts: 0xffffff, socks: 0x2f6fd0, gk: 0xff7a1a }, pattern: 'stripes' },
  { colors: { shirt: 0x2f9a50, shirt2: 0xffffff, shorts: 0x2f9a50, socks: 0xffffff, gk: 0xe0457b }, pattern: 'hoops' },
  { colors: { shirt: 0xffd23f, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0xffd23f, gk: 0x7d5cff }, pattern: 'stripes' },
  { colors: { shirt: 0x8a3fd0, shirt2: 0xffd23f, shorts: 0xffd23f, socks: 0x8a3fd0, gk: 0x2fbf5a }, pattern: 'sash' },
  { colors: { shirt: 0xffffff, shirt2: 0x1a1a1a, shorts: 0x1a1a1a, socks: 0xffffff, gk: 0xff5a5a }, pattern: 'sash' },
];

// ---------------------------------------------------------------- tipi

export interface MPlayer {
  id: number;
  name: string;
  number: number;
  age: number;
  role: Role;
  stats: PlayerStats;
  /** Tetto di crescita: media massima delle statistiche. */
  pot: number;
  /** 0..100 */
  morale: number;
  /** 0..100 */
  energy: number;
  /** Stipendio settimanale (€). */
  salary: number;
  look: PlayerDef['look'];
  goals: number;
  apps: number;
}

export interface MClub {
  id: string;
  name: string;
  short: string;
  colors: TeamDef['colors'];
  pattern: TeamDef['pattern'];
  /** Forza (come le stelle, ma decimale). */
  level: number;
}

export interface Fixture {
  h: string;
  a: string;
  gh?: number;
  ga?: number;
}

export interface TableRow {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface SeasonEnd {
  season: number;
  division: number;
  pos: number;
  outcome: 'promosso' | 'retrocesso' | 'salvo' | 'campione';
  prize: number;
  retired: string[];
  youth: string[];
}

export interface ManagerState {
  v: 1;
  seed: number;
  difficulty: Difficulty;
  season: number;
  /** Giornata attuale (indice nel calendario). */
  week: number;
  division: number;
  club: MClub;
  squad: MPlayer[];
  /** Id dei 5 titolari, nell'ordine dei posti della formazione. */
  lineup: number[];
  formation: FormationId;
  training: TrainingId;
  budget: number;
  fans: number;
  stadium: number;
  trainingCenter: number;
  market: MPlayer[];
  nextId: number;
  clubs: MClub[];
  fixtures: Fixture[][];
  news: string[];
  /** Albo: piazzamento di ogni stagione. */
  history: { season: number; division: number; pos: number }[];
  titles: number;
  /** Fine stagione appena avvenuta (da mostrare una volta). */
  seasonEnd?: SeasonEnd;
  /** Ultimo resoconto settimanale delle finanze. */
  lastWeek?: { tickets: number; sponsor: number; salaries: number };
}

export const ME = 'me';

// ---------------------------------------------------------------- giocatori

/** Valutazione 1..99 in base al ruolo. */
export function ovr(stats: PlayerStats, role: Role): number {
  const s = stats;
  let v: number;
  // la velocità conta più di tutto nella simulazione (misurato), poi il resto per ruolo
  if (role === 'GK') v = s.keeping * 0.5 + s.speed * 0.3 + s.pass * 0.1 + s.control * 0.1;
  else if (role === 'DEF') v = s.speed * 0.4 + s.tackle * 0.25 + s.control * 0.2 + s.pass * 0.15;
  else if (role === 'MID') v = s.speed * 0.4 + s.pass * 0.25 + s.control * 0.2 + s.shot * 0.15;
  else v = s.speed * 0.4 + s.shot * 0.3 + s.control * 0.2 + s.pass * 0.1;
  return Math.round(clamp(((v - 0.45) / 0.75) * 100, 1, 99));
}

export function playerOvr(p: MPlayer): number {
  return ovr(p.stats, p.role);
}

/** Valutazione massima raggiungibile (indicativa). */
export function potOvr(p: MPlayer): number {
  return Math.round(clamp(((p.pot + roleBonus(p.role) - 0.45) / 0.75) * 100, 1, 99));
}

function roleBonus(role: Role): number {
  return role === 'GK' ? 0.06 : 0.04;
}

function salaryFor(o: number): number {
  return Math.max(50, Math.round((o * o * 0.075) / 10) * 10);
}

/** Valore di mercato (€). */
export function playerValue(p: MPlayer): number {
  const o = playerOvr(p);
  const young = p.age <= 21 ? 1.5 : p.age <= 25 ? 1.25 : p.age <= 29 ? 1 : p.age <= 32 ? 0.7 : 0.45;
  const growth = 1 + clamp(potOvr(p) - o, 0, 30) / 40;
  return Math.max(1000, Math.round((salaryFor(o) * 50 * young * growth) / 500) * 500);
}

export function sellPrice(p: MPlayer): number {
  return Math.round((playerValue(p) * 0.8) / 500) * 500;
}

function makeStatsFor(rng: Rng, role: Role, level: number): PlayerStats {
  const r = () => rng.range(-0.07, 0.07);
  const b = 0.72 + level * 0.07;
  const s: PlayerStats = { speed: b + r(), shot: b + r(), pass: b + r(), tackle: b + r(), control: b + r(), keeping: b - 0.12 + r() };
  if (role === 'FWD') {
    s.shot += 0.08;
    s.speed += 0.04;
  } else if (role === 'DEF') s.tackle += 0.08;
  else if (role === 'MID') {
    s.pass += 0.06;
    s.control += 0.04;
  } else s.keeping += 0.22;
  for (const k of STAT_KEYS) s[k] = round3(clamp(s[k], 0.5, 1.25));
  return s;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function avg(s: PlayerStats) {
  return (s.speed + s.shot + s.pass + s.control + s.tackle + s.keeping) / 6;
}

function pickName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const n = rng.pick(SURNAMES);
    if (!used.has(n)) return n;
  }
  let n = rng.pick(SURNAMES);
  let k = 2;
  while (used.has(`${n} ${k}`)) k++;
  n = `${n} ${k}`;
  return n;
}

export function newPlayer(rng: Rng, id: number, role: Role, level: number, age: number, used: Set<string>): MPlayer {
  const stats = makeStatsFor(rng, role, level);
  // i giovani hanno più margine
  const room = age <= 19 ? rng.range(0.14, 0.3) : age <= 23 ? rng.range(0.08, 0.2) : age <= 27 ? rng.range(0.03, 0.1) : rng.range(0, 0.04);
  const name = pickName(rng, used);
  used.add(name);
  const p: MPlayer = {
    id,
    name,
    number: 0,
    age,
    role,
    stats,
    pot: round3(Math.min(1.2, avg(stats) + room)),
    morale: 60,
    energy: 100,
    salary: 0,
    look: { skin: Math.floor(rng.next() * 5), hair: Math.floor(rng.next() * 6), hairStyle: Math.floor(rng.next() * 4) },
    goals: 0,
    apps: 0,
  };
  p.salary = salaryFor(playerOvr(p));
  return p;
}

function randomAge(rng: Rng): number {
  return Math.floor(rng.range(17, 34));
}

// ---------------------------------------------------------------- campionato

function clubFromSeed(s: TeamSeed, div: number, rng: Rng): MClub {
  const [lo, hi] = DIV_LEVEL[div];
  // le "stelle" della squadra indicano chi è più forte nella divisione
  const rank = (s.stars - (div === 3 ? 4 : div + 1)) * 0.3;
  return { id: s.id, name: s.name, short: s.short, colors: s.colors, pattern: s.pattern, level: round3(clamp(rng.range(lo, hi) + rank, lo, hi)) };
}

/** Calendario all'italiana andata e ritorno (metodo del cerchio). */
export function roundRobin(ids: string[]): Fixture[][] {
  const n = ids.length;
  const arr = ids.slice();
  const first: Fixture[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      round.push(r % 2 === 0 ? { h: a, a: b } : { h: b, a: a });
    }
    first.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = first.map((r) => r.map((f) => ({ h: f.a, a: f.h })));
  return [...first, ...second];
}

function setupLeague(st: ManagerState) {
  const rng = new Rng(st.seed + st.season * 977 + st.division * 31);
  st.clubs = CLUB_SEEDS[st.division].map((s) => clubFromSeed(s, st.division, rng));
  const ids = [ME, ...st.clubs.map((c) => c.id)];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  st.fixtures = roundRobin(ids);
  st.week = 0;
}

export function clubOf(st: ManagerState, id: string): MClub {
  if (id === ME) return st.club;
  return st.clubs.find((c) => c.id === id) ?? st.clubs[0];
}

export function table(st: ManagerState): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const id of [ME, ...st.clubs.map((c) => c.id)]) rows.set(id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  for (const round of st.fixtures) {
    for (const f of round) {
      if (f.gh === undefined || f.ga === undefined) continue;
      const h = rows.get(f.h)!;
      const a = rows.get(f.a)!;
      h.p++;
      a.p++;
      h.gf += f.gh;
      h.ga += f.ga;
      a.gf += f.ga;
      a.ga += f.gh;
      if (f.gh > f.ga) {
        h.w++;
        a.l++;
        h.pts += 3;
      } else if (f.gh < f.ga) {
        a.w++;
        h.l++;
        a.pts += 3;
      } else {
        h.d++;
        a.d++;
        h.pts++;
        a.pts++;
      }
    }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.id.localeCompare(y.id));
}

export function position(st: ManagerState): number {
  return table(st).findIndex((r) => r.id === ME) + 1;
}

/** Partita del giocatore nella giornata attuale. */
export function myFixture(st: ManagerState): Fixture | null {
  const round = st.fixtures[st.week];
  if (!round) return null;
  return round.find((f) => f.h === ME || f.a === ME) ?? null;
}

export function opponentOf(st: ManagerState): MClub | null {
  const f = myFixture(st);
  if (!f) return null;
  return clubOf(st, f.h === ME ? f.a : f.h);
}

export function isHome(st: ManagerState): boolean {
  return myFixture(st)?.h === ME;
}

// ---------------------------------------------------------------- nuova carriera

export function newManager(name: string, kit: number, difficulty: Difficulty, seed = Date.now()): ManagerState {
  const rng = new Rng(seed);
  const k = CLUB_KITS[kit % CLUB_KITS.length];
  const short = name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const st: ManagerState = {
    v: 1,
    seed,
    difficulty,
    season: 1,
    week: 0,
    division: 0,
    club: { id: ME, name, short, colors: k.colors, pattern: k.pattern, level: 0.8 },
    squad: [],
    lineup: [],
    formation: 'rombo',
    training: 'tecnica',
    budget: 15000,
    fans: 220,
    stadium: 0,
    trainingCenter: 0,
    market: [],
    nextId: 1,
    clubs: [],
    fixtures: [],
    news: [],
    history: [],
    titles: 0,
  };
  const used = new Set<string>();
  const roles: Role[] = ['GK', 'DEF', 'MID', 'MID', 'FWD', 'GK', 'DEF', 'MID', 'FWD'];
  roles.forEach((role, i) => {
    const lvl = i < 5 ? rng.range(0.9, 1.3) : rng.range(0.4, 0.9);
    const age = i === 7 ? 17 : i === 2 ? 18 : randomAge(rng);
    st.squad.push(newPlayer(rng, st.nextId++, role, lvl, age, used));
  });
  assignNumbers(st);
  st.lineup = st.squad.slice(0, 5).map((p) => p.id);
  setupLeague(st);
  refreshMarket(st, rng);
  st.news = [`Benvenuto, mister! ${name} parte dalla ${DIVISIONS[0].name}.`, 'Obiettivo: arrivare tra le prime 2 e salire di categoria.'];
  return st;
}

function assignNumbers(st: ManagerState) {
  const used = new Set(st.squad.filter((p) => p.number > 0).map((p) => p.number));
  const pref: Record<Role, number[]> = { GK: [1, 12, 22], DEF: [2, 3, 4, 5, 6, 13], MID: [8, 7, 10, 14, 16, 18], FWD: [9, 11, 19, 20, 17] };
  for (const p of st.squad) {
    if (p.number > 0) continue;
    let n = pref[p.role].find((x) => !used.has(x));
    if (n === undefined) {
      n = 21;
      while (used.has(n)) n++;
    }
    p.number = n;
    used.add(n);
  }
}

// ---------------------------------------------------------------- mercato

export function refreshMarket(st: ManagerState, rng = new Rng(st.seed + st.season * 131 + st.week * 17)) {
  const [lo, hi] = DIV_LEVEL[st.division];
  const used = new Set(st.squad.map((p) => p.name));
  const roles: Role[] = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
  st.market = roles.map((role) => {
    const young = rng.chance(0.3);
    const age = young ? Math.floor(rng.range(16, 20)) : randomAge(rng);
    const lvl = young ? rng.range(lo - 0.6, lo + 0.2) : rng.range(lo - 0.2, hi + 0.5);
    return newPlayer(rng, st.nextId++, role, lvl, age, used);
  });
}

export function buyPrice(p: MPlayer): number {
  return playerValue(p);
}

export function canBuy(st: ManagerState, p: MPlayer): string | null {
  if (st.squad.length >= MAX_SQUAD) return `Rosa piena (max ${MAX_SQUAD})`;
  if (st.budget < buyPrice(p)) return 'Soldi insufficienti';
  return null;
}

export function buy(st: ManagerState, id: number): boolean {
  const i = st.market.findIndex((p) => p.id === id);
  if (i < 0) return false;
  const p = st.market[i];
  if (canBuy(st, p)) return false;
  st.budget -= buyPrice(p);
  st.market.splice(i, 1);
  if (st.squad.some((q) => q.name === p.name)) p.name = `${p.name} J.`;
  p.number = 0;
  p.morale = 75;
  st.squad.push(p);
  assignNumbers(st);
  st.news.unshift(`Acquistato ${p.name} (${ROLE_LABEL[p.role]}) per ${money(buyPrice(p))}.`);
  return true;
}

export function canSell(st: ManagerState, id: number): string | null {
  if (st.squad.length <= MIN_SQUAD) return `Servono almeno ${MIN_SQUAD} giocatori`;
  const p = st.squad.find((x) => x.id === id);
  if (!p) return 'Giocatore non trovato';
  if (p.role === 'GK' && st.squad.filter((x) => x.role === 'GK').length <= 1) return 'È il tuo unico portiere';
  return null;
}

export function sell(st: ManagerState, id: number): boolean {
  if (canSell(st, id)) return false;
  const i = st.squad.findIndex((p) => p.id === id);
  const p = st.squad[i];
  const price = sellPrice(p);
  st.budget += price;
  st.squad.splice(i, 1);
  st.lineup = st.lineup.filter((x) => x !== id);
  fixLineup(st);
  st.news.unshift(`Ceduto ${p.name} per ${money(price)}.`);
  return true;
}

// ---------------------------------------------------------------- formazione

/** Completa la formazione se manca qualcuno (dopo una cessione, un ritiro...). */
export function fixLineup(st: ManagerState) {
  const ids = new Set(st.squad.map((p) => p.id));
  const lu = st.lineup.filter((id) => ids.has(id));
  const roles = FORMATIONS[st.formation].roles;
  while (lu.length < 5) {
    const slot = lu.length;
    const want = roles[slot];
    const free = st.squad.filter((p) => !lu.includes(p.id));
    free.sort((a, b) => (b.role === want ? 1 : 0) - (a.role === want ? 1 : 0) || playerOvr(b) - playerOvr(a));
    if (!free[0]) break;
    lu.push(free[0].id);
  }
  st.lineup = lu;
}

/** Scambia due giocatori (titolari o riserve). */
export function swapPlayers(st: ManagerState, a: number, b: number) {
  const ia = st.lineup.indexOf(a);
  const ib = st.lineup.indexOf(b);
  if (ia >= 0 && ib >= 0) {
    st.lineup[ia] = b;
    st.lineup[ib] = a;
  } else if (ia >= 0) st.lineup[ia] = b;
  else if (ib >= 0) st.lineup[ib] = a;
  else {
    // due riserve: si scambia l'ordine in rosa
    const pa = st.squad.findIndex((p) => p.id === a);
    const pb = st.squad.findIndex((p) => p.id === b);
    if (pa >= 0 && pb >= 0) [st.squad[pa], st.squad[pb]] = [st.squad[pb], st.squad[pa]];
  }
}

/** Formazione migliore in automatico: per ogni posto il più forte disponibile (contando l'energia). */
export function autoLineup(st: ManagerState) {
  const roles = FORMATIONS[st.formation].roles;
  const taken = new Set<number>();
  const lu: number[] = [];
  for (const role of roles) {
    let best: MPlayer | null = null;
    let bestV = -1;
    for (const p of st.squad) {
      if (taken.has(p.id)) continue;
      const v = ovr(effectiveStats(p, role), role);
      if (v > bestV) {
        bestV = v;
        best = p;
      }
    }
    if (best) {
      taken.add(best.id);
      lu.push(best.id);
    }
  }
  st.lineup = lu;
}

export function starters(st: ManagerState): MPlayer[] {
  return st.lineup.map((id) => st.squad.find((p) => p.id === id)).filter((p): p is MPlayer => !!p);
}

/** Moltiplicatore per chi gioca fuori ruolo. */
export function roleFit(natural: Role, slot: Role): number {
  if (natural === slot) return 1;
  if (natural === 'GK' || slot === 'GK') return 0.75;
  if ((natural === 'DEF' && slot === 'FWD') || (natural === 'FWD' && slot === 'DEF')) return 0.9;
  return 0.95;
}

/** Statistiche in campo: energia, morale e ruolo contano. */
export function effectiveStats(p: MPlayer, slot: Role): PlayerStats {
  const f = (0.8 + 0.2 * (p.energy / 100)) * (0.95 + 0.1 * (p.morale / 100)) * roleFit(p.role, slot);
  const s = { ...p.stats };
  for (const k of STAT_KEYS) s[k] = round3(s[k] * f);
  if (slot === 'GK' && p.role !== 'GK') s.keeping = round3(Math.min(s.keeping, 0.7));
  return s;
}

/** Forza della squadra titolare (media delle valutazioni nei rispettivi posti). */
export function teamRating(st: ManagerState): number {
  const roles = FORMATIONS[st.formation].roles;
  const s = starters(st);
  if (!s.length) return 0;
  return Math.round(s.reduce((t, p, i) => t + ovr(effectiveStats(p, roles[i]), roles[i]), 0) / s.length);
}

/** Valutazione di un club avversario (media dei suoi titolari). */
export function clubRating(st: ManagerState, c: MClub): number {
  const t = clubTeamDef(st, c);
  return Math.round(t.players.reduce((s, p) => s + ovr(p.stats, p.role), 0) / t.players.length);
}

// ---------------------------------------------------------------- squadre per la partita

export function myTeamDef(st: ManagerState): TeamDef {
  const roles = FORMATIONS[st.formation].roles;
  const players: PlayerDef[] = starters(st).map((p, i) => ({
    name: p.name,
    number: p.number,
    role: roles[i],
    stats: effectiveStats(p, roles[i]),
    look: p.look,
  }));
  return {
    id: ME,
    name: st.club.name,
    short: st.club.short,
    colors: st.club.colors,
    pattern: st.club.pattern,
    players,
    stars: clamp(Math.round((teamRating(st) - 30) / 12), 1, 5),
  };
}

export function clubTeamDef(st: ManagerState, c: MClub): TeamDef {
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id: c.id,
    name: c.name,
    short: c.short,
    colors: c.colors,
    pattern: c.pattern,
    players: makePlayers(h + st.season * 7919, c.level),
    stars: clamp(Math.round(c.level), 1, 5),
  };
}

export function matchPitch(st: ManagerState): PitchId {
  if (isHome(st)) return DIVISIONS[st.division].pitch;
  const pool: PitchId[] = ['stadio', 'spiaggia', 'neve', 'tetto', 'quartiere'];
  return pool[(st.week * 7 + st.season * 3 + st.division) % pool.length];
}

/** Meteo e orario della partita della giornata (sempre gli stessi per quella giornata). */
export function matchConditions(st: ManagerState) {
  const rng = new Rng(st.seed * 3 + st.season * 1009 + st.week * 101 + 17);
  return randomConditions(matchPitch(st), () => rng.next());
}

/** Partita simulata con la vera simulazione (CPU contro CPU), senza grafica. */
export function simulateMyMatch(st: ManagerState, seed = st.seed + st.season * 1009 + st.week * 101): MatchResult {
  const me = myTeamDef(st);
  const opp = clubTeamDef(st, opponentOf(st)!);
  const home = isHome(st);
  const sim = new MatchSim({
    home: home ? me : opp,
    away: home ? opp : me,
    pitch: PITCHES[matchPitch(st)],
    ...matchConditions(st),
    difficulty: 'normale',
    durationSec: SIM_DURATION,
    powerUps: false,
    goldenGoal: false,
    seed,
    humanTeam: null,
  });
  const dt = 1 / 30;
  for (let t = 0; t < SIM_DURATION + 60 && sim.phase !== 'end'; t += dt) {
    sim.update(dt);
    sim.events.length = 0;
  }
  const r: MatchResult = { score: [sim.score[0], sim.score[1]], stats: sim.stats, goldenGoal: false, scorers: sim.scorers.slice() };
  if (!home) {
    // dal punto di vista del giocatore: squadra 0 = noi
    r.score = [r.score[1], r.score[0]];
    r.scorers = r.scorers.map((s) => ({ ...s, team: (1 - s.team) as 0 | 1 }));
    const sw = <T>(x: [T, T]): [T, T] => [x[1], x[0]];
    r.stats = { shots: sw(r.stats.shots), passes: sw(r.stats.passes), tackles: sw(r.stats.tackles), possession: sw(r.stats.possession) };
  }
  return r;
}

// ---------------------------------------------------------------- settimana

function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L && k < 12);
  return k - 1;
}

function quickScore(rng: Rng, h: MClub, a: MClub): [number, number] {
  const d = h.level - a.level;
  return [poisson(rng, Math.max(0.5, 2.0 + d * 0.5 + 0.2)), poisson(rng, Math.max(0.5, 2.0 - d * 0.5))];
}

export interface WeekReport {
  myGoals: number;
  oppGoals: number;
  opp: string;
  home: boolean;
  income: number;
  tickets: number;
  salaries: number;
  sponsor: number;
  pos: number;
  /** Notizie della settimana (allenamento, morale...). */
  notes: string[];
  seasonEnd?: SeasonEnd;
}

/**
 * Registra la partita del giocatore (gol dal suo punto di vista, marcatori
 * della sua squadra), simula le altre, applica allenamento e finanze e passa
 * alla giornata successiva. A fine calendario chiude la stagione.
 */
export function applyManagerResult(st: ManagerState, myGoals: number, oppGoals: number, myScorers: string[]): WeekReport {
  const rng = new Rng(st.seed + st.season * 7001 + st.week * 37 + myGoals * 3 + oppGoals);
  const f = myFixture(st)!;
  const home = f.h === ME;
  const oppId = home ? f.a : f.h;
  f.gh = home ? myGoals : oppGoals;
  f.ga = home ? oppGoals : myGoals;
  for (const o of st.fixtures[st.week]) {
    if (o === f) continue;
    const [gh, ga] = quickScore(rng, clubOf(st, o.h), clubOf(st, o.a));
    o.gh = gh;
    o.ga = ga;
  }
  const notes: string[] = [];
  const won = myGoals > oppGoals;
  const lost = myGoals < oppGoals;

  // giocatori: energia, morale, presenze, gol
  const startersIds = new Set(st.lineup);
  for (const p of st.squad) {
    const starter = startersIds.has(p.id);
    if (starter) {
      p.apps++;
      p.energy -= 20;
      p.morale += 3;
    } else {
      p.morale -= 2;
    }
    p.morale += won ? 7 : lost ? -7 : 1;
  }
  for (const name of myScorers) {
    const p = st.squad.find((x) => x.name === name);
    if (p) {
      p.goals++;
      p.morale += 4;
    }
  }

  // allenamento della settimana
  const tr = TRAININGS[st.training];
  const boost = 1 + st.trainingCenter * 0.3;
  let improved: MPlayer | null = null;
  let bestGain = 0;
  for (const p of st.squad) {
    p.energy += 20;
    if (st.training === 'riposo') {
      p.energy += 14;
      p.morale += 4;
      continue;
    }
    p.energy -= 3;
    const ageF = p.age <= 19 ? 1.7 : p.age <= 22 ? 1.35 : p.age <= 26 ? 1 : p.age <= 29 ? 0.6 : p.age <= 32 ? 0.25 : 0;
    const room = clamp((p.pot - avg(p.stats)) / 0.1, 0, 1.2);
    const before = playerOvr(p);
    for (const k of tr.stats) {
      if (k === 'keeping' && p.role !== 'GK') continue;
      const g = 0.007 * ageF * boost * room * rng.range(0.4, 1.6);
      p.stats[k] = round3(Math.min(1.25, p.stats[k] + g));
    }
    const gain = playerOvr(p) - before;
    if (gain > bestGain) {
      bestGain = gain;
      improved = p;
    }
  }
  if (improved) notes.push(`${improved.name} migliora in allenamento: ora ${playerOvr(improved)}.`);
  for (const p of st.squad) {
    p.energy = clamp(Math.round(p.energy), 5, 100);
    p.morale = clamp(Math.round(p.morale), 5, 100);
  }
  const tired = starters(st).filter((p) => p.energy < 45);

  // tifosi e soldi
  st.fans = Math.round(st.fans * (won ? 1.05 : lost ? 0.98 : 1.01) + (won ? 8 : 0));
  const div = DIVISIONS[st.division];
  const tickets = home ? Math.min(st.fans, STADIUM_LEVELS[st.stadium].seats) * div.ticket : 0;
  const salaries = st.squad.reduce((t, p) => t + p.salary, 0);
  const sponsor = div.sponsor;
  st.budget += tickets + sponsor - salaries;
  st.lastWeek = { tickets, sponsor, salaries };

  const oppName = clubOf(st, oppId).name;
  st.news.unshift(`G${st.week + 1}: ${home ? `${st.club.name} ${myGoals}-${oppGoals} ${oppName}` : `${oppName} ${oppGoals}-${myGoals} ${st.club.name}`}`);
  st.news.unshift(...notes);
  if (tired.length) notes.push(`Stanchi: ${tired.map((p) => p.name).join(', ')}. Fai turnover o riposo.`);
  st.week++;
  refreshMarket(st, rng);
  fixLineup(st);

  const rep: WeekReport = { myGoals, oppGoals, opp: oppId, home, income: tickets + sponsor - salaries, tickets, salaries, sponsor, pos: position(st), notes };
  if (st.week >= st.fixtures.length) rep.seasonEnd = endSeason(st, rng);
  st.news = st.news.slice(0, 12);
  return rep;
}

// ---------------------------------------------------------------- fine stagione

export function endSeason(st: ManagerState, rng = new Rng(st.seed + st.season * 4441)): SeasonEnd {
  const pos = position(st);
  const div = st.division;
  let outcome: SeasonEnd['outcome'] = 'salvo';
  if (pos === 1) outcome = 'campione';
  else if (pos <= 2 && div < TOP_DIVISION) outcome = 'promosso';
  else if (pos >= 7 && div > 0) outcome = 'retrocesso';
  const prize = Math.round((DIVISIONS[div].prize * (9 - pos)) / 8 / 500) * 500;
  st.budget += prize;
  st.history.push({ season: st.season, division: div, pos });
  if (pos === 1) st.titles++;
  if ((outcome === 'campione' || outcome === 'promosso') && div < TOP_DIVISION) st.division++;
  else if (outcome === 'retrocesso') st.division--;
  st.fans = Math.round(st.fans * (st.division > div ? 1.6 : st.division < div ? 0.75 : 1.1));

  // invecchiamento, crescita estiva, ritiri
  const retired: string[] = [];
  for (const p of [...st.squad]) {
    p.age++;
    if (p.age >= 31) {
      const drop = (p.age - 30) * 0.012;
      for (const k of STAT_KEYS) p.stats[k] = round3(Math.max(0.5, p.stats[k] - drop * rng.range(0.5, 1.5)));
    }
    if (p.age >= 35 && rng.chance(0.4 + (p.age - 35) * 0.3)) {
      retired.push(p.name);
      st.squad.splice(st.squad.indexOf(p), 1);
    }
  }
  for (const p of st.squad) {
    p.energy = 100;
    p.morale = clamp(Math.round(p.morale * 0.5 + 35), 30, 90);
    p.goals = 0;
    p.apps = 0;
    p.salary = Math.max(p.salary, salaryFor(playerOvr(p)));
  }
  // vivaio: un giovane ogni anno, e altri se la rosa è troppo corta
  const youth: string[] = [];
  const used = new Set(st.squad.map((p) => p.name));
  const want = Math.max(1, MIN_SQUAD + 1 - st.squad.length);
  for (let i = 0; i < want && st.squad.length < MAX_SQUAD; i++) {
    const hasGK = st.squad.some((p) => p.role === 'GK');
    const role: Role = !hasGK ? 'GK' : rng.pick(['DEF', 'MID', 'FWD'] as Role[]);
    const p = newPlayer(rng, st.nextId++, role, DIV_LEVEL[st.division][0] - 0.4 + st.trainingCenter * 0.25, 16, used);
    p.pot = round3(Math.min(1.2, p.pot + st.trainingCenter * 0.03));
    st.squad.push(p);
    youth.push(p.name);
  }
  assignNumbers(st);
  const se: SeasonEnd = { season: st.season, division: div, pos, outcome, prize, retired, youth };
  st.season++;
  setupLeague(st);
  refreshMarket(st, rng);
  fixLineup(st);
  st.seasonEnd = se;
  st.news.unshift(`Inizia la stagione ${st.season} in ${DIVISIONS[st.division].name}.`);
  return se;
}

// ---------------------------------------------------------------- strutture

export function upgradeCost(st: ManagerState, what: 'stadium' | 'training'): number | null {
  const lvl = what === 'stadium' ? st.stadium : st.trainingCenter;
  const costs = what === 'stadium' ? STADIUM_COST : TRAINING_COST;
  return lvl < costs.length ? costs[lvl] : null;
}

export function upgrade(st: ManagerState, what: 'stadium' | 'training'): boolean {
  const c = upgradeCost(st, what);
  if (c === null || st.budget < c) return false;
  st.budget -= c;
  if (what === 'stadium') st.stadium++;
  else st.trainingCenter++;
  st.news.unshift(what === 'stadium' ? `Lavori finiti: ${STADIUM_LEVELS[st.stadium].name}!` : `Nuovo ${TRAINING_LEVELS[st.trainingCenter]}!`);
  return true;
}

export function weeklyBalance(st: ManagerState): { salaries: number; sponsor: number; tickets: number } {
  const div = DIVISIONS[st.division];
  return {
    salaries: st.squad.reduce((t, p) => t + p.salary, 0),
    sponsor: div.sponsor,
    tickets: Math.min(st.fans, STADIUM_LEVELS[st.stadium].seats) * div.ticket,
  };
}

export function money(v: number): string {
  const s = Math.abs(Math.round(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}€${s}`;
}

/** Minuto "da telecronaca" (0..90) di un momento della partita. */
export function minuteOf(time: number, duration: number): number {
  return clamp(Math.round((time / duration) * 90), 1, 90);
}
