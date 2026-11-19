import { TEAMS, teamById } from '../data/teams';
import { PITCHES, PITCH_ORDER } from '../data/pitches';
import { Rng, clamp } from '../sim/math';
import type { Difficulty, MatchMods, PitchId, PlayerDef, PlayerStats, TeamDef, Weather } from '../sim/types';
import type { MatchLaunch, MatchOutcome } from './modes';

/**
 * Modalità SOPRAVVIVENZA (Roguelite 5v5):
 * Parti con una squadra e affronti una scalata infinita di round da 90s
 * su campi, meteo e regole arcade speciali. Ogni vittoria ti fa scegliere tra
 * rubare un giocatore agli avversari battuti o prendere un bonus per tutta la rosa.
 */

export type SurvivalPerkId =
  | 'speed'
  | 'shot'
  | 'pass'
  | 'tackle'
  | 'superStart'
  | 'turboStart'
  | 'wallStart'
  | 'stamina';

export interface SurvivalPerkDef {
  id: SurvivalPerkId;
  name: string;
  desc: string;
  stat?: keyof PlayerStats;
}

export const SURVIVAL_PERKS: Record<SurvivalPerkId, SurvivalPerkDef> = {
  speed: { id: 'speed', name: 'SCARPINI RAZZA', desc: '+8% Velocità a tutta la squadra', stat: 'speed' },
  shot: { id: 'shot', name: 'CANNONATA', desc: '+9% Tiro e controllo palla', stat: 'shot' },
  pass: { id: 'pass', name: 'TIKI-TAKA', desc: '+9% Passaggi e dribbling', stat: 'pass' },
  tackle: { id: 'tackle', name: 'MURO D\'ACCIAIO', desc: '+9% Contrasti e parate', stat: 'tackle' },
  superStart: { id: 'superStart', name: 'CARICA ESPLOSIVA', desc: 'La barra SUPER parte già al 60%' },
  turboStart: { id: 'turboStart', name: 'SCATTO INIZIALE', desc: 'Inizi ogni round con 8s di TURBO' },
  wallStart: { id: 'wallStart', name: 'PORTA BLINDATA', desc: 'Inizi ogni round con 10s di MURO' },
  stamina: { id: 'stamina', name: 'FIATO INFINITO', desc: 'Gli scatti non consumano energia' },
};

export const PERK_ORDER: SurvivalPerkId[] = ['speed', 'shot', 'pass', 'tackle', 'superStart', 'turboStart', 'wallStart', 'stamina'];

export type SurvivalRuleId = 'normal' | 'super2x' | 'turbo' | 'fire' | 'fastPu' | 'rainNight' | 'goldenBlitz';

export interface SurvivalRuleDef {
  id: SurvivalRuleId;
  name: string;
  desc: string;
  mods: MatchMods;
  weather?: Weather;
  night?: boolean;
  durationSec?: number;
}

export const SURVIVAL_RULES: Record<SurvivalRuleId, SurvivalRuleDef> = {
  normal: {
    id: 'normal',
    name: 'ARCADE CLASSICO',
    desc: 'Nessun modificatore: 5v5 puro e veloce.',
    mods: {},
  },
  super2x: {
    id: 'super2x',
    name: 'SUPER CARICA 2X',
    desc: 'La barra SUPER si riempie al doppio della velocità!',
    mods: { superMult: 2 },
  },
  turbo: {
    id: 'turbo',
    name: 'RITMO FOLLE',
    desc: 'Tutti più veloci del 20% e fiato infinito!',
    mods: { speedMult: 1.2, staminaMult: 0 },
  },
  fire: {
    id: 'fire',
    name: 'PIOGGIA DI FUOCO',
    desc: 'Ogni tiro parte infuocato per entrambe le squadre!',
    mods: { alwaysFire: true },
  },
  fastPu: {
    id: 'fastPu',
    name: 'CAOS POWER-UP',
    desc: 'I bonus sul campo compaiono al doppio della velocità!',
    mods: { fastPowerUps: true },
  },
  rainNight: {
    id: 'rainNight',
    name: 'NOTTE DA LEONI',
    desc: 'Sotto i riflettori e la pioggia battente!',
    mods: { superMult: 1.5 },
    weather: 'pioggia',
    night: true,
  },
  goldenBlitz: {
    id: 'goldenBlitz',
    name: 'BLITZ 60 SECONDI',
    desc: 'Partita lampo da 60 secondi: non c\'è tempo da perdere!',
    mods: { speedMult: 1.12 },
    durationSec: 60,
  },
};

const ROUND_RULES: SurvivalRuleId[] = ['super2x', 'turbo', 'fire', 'fastPu', 'rainNight', 'goldenBlitz'];

export type SurvivalDraftOption =
  | { kind: 'steal'; player: PlayerDef; roleIdx: number; fromTeam: string }
  | { kind: 'perk'; perkId: SurvivalPerkId };

export interface SurvivalNext {
  oppId: string;
  opp: TeamDef;
  pitch: PitchId;
  weather: Weather;
  night: boolean;
  rule: SurvivalRuleId;
  difficulty: Difficulty;
  durationSec: number;
  isBoss: boolean;
}

export interface SurvivalEndSummary {
  roundReached: number;
  wins: number;
  score: [number, number];
  coins: number;
  packs: number;
  newRecord: boolean;
  teamName: string;
  stolen: number;
}

export interface SurvivalState {
  active: boolean;
  seed: number;
  round: number;
  difficulty: Difficulty;
  team: TeamDef;
  perks: SurvivalPerkId[];
  stolen: number;
  goalsFor: number;
  goalsAgainst: number;
  coinsEarned: number;
  next: SurvivalNext;
  pendingDraft?: SurvivalDraftOption[];
  lastSummary?: SurvivalEndSummary;
}

export interface SurvivalRecord {
  bestRound: number;
  runs: number;
  totalWins: number;
}

function clonePlayer(p: PlayerDef): PlayerDef {
  return {
    ...p,
    stats: { ...p.stats },
    look: { ...p.look },
    skills: p.skills ? [...p.skills] : undefined,
  };
}

function cloneTeam(t: TeamDef): TeamDef {
  return {
    ...t,
    colors: { ...t.colors },
    players: t.players.map(clonePlayer),
  };
}

/** Media 0..100 delle statistiche di un giocatore per confronti rapidi nel draft. */
export function playerOverall(p: PlayerDef): number {
  const s = p.stats;
  const avg = p.role === 'GK'
    ? (s.keeping * 2 + s.tackle + s.pass + s.speed) / 5
    : p.role === 'DEF'
      ? (s.tackle * 2 + s.pass + s.speed + s.control) / 5
      : (s.shot + s.speed + s.control + s.pass) / 4;
  return Math.round(avg * 80);
}

function applyStatPerkToPlayer(p: PlayerDef, perkId: SurvivalPerkId) {
  const def = SURVIVAL_PERKS[perkId];
  if (!def.stat) return;
  const st = p.stats;
  const cap = 1.3;
  if (perkId === 'speed') st.speed = Math.min(cap, st.speed + 0.08);
  if (perkId === 'shot') {
    st.shot = Math.min(cap, st.shot + 0.09);
    st.control = Math.min(cap, st.control + 0.05);
  }
  if (perkId === 'pass') {
    st.pass = Math.min(cap, st.pass + 0.09);
    st.control = Math.min(cap, st.control + 0.05);
  }
  if (perkId === 'tackle') {
    st.tackle = Math.min(cap, st.tackle + 0.09);
    st.keeping = Math.min(cap, st.keeping + 0.09);
  }
}

export function generateRound(round: number, baseDiff: Difficulty, seed: number, myTeamId: string, prevPitch?: PitchId): SurvivalNext {
  const rng = new Rng(seed + round * 9973);
  const isBoss = round % 5 === 0;
  // Selezione avversario progressiva per stelle
  const minStars = isBoss ? 5 : round <= 2 ? 2 : round <= 5 ? 3 : 4;
  const maxStars = isBoss ? 5 : round <= 2 ? 3 : round <= 5 ? 4 : 5;
  let pool = TEAMS.filter((t) => t.id !== myTeamId && t.stars >= minStars && t.stars <= maxStars);
  if (!pool.length) pool = TEAMS.filter((t) => t.id !== myTeamId);
  const baseOpp = rng.pick(pool);
  const opp = cloneTeam(baseOpp);
  // Scalatura graduale delle statistiche avversarie
  const boost = (round - 1) * 0.022 + (isBoss ? 0.05 : 0);
  if (boost > 0) {
    for (const p of opp.players) {
      for (const k of Object.keys(p.stats) as (keyof PlayerStats)[]) {
        p.stats[k] = clamp(p.stats[k] + boost, 0.5, 1.28);
      }
    }
  }
  if (isBoss) opp.name = `${opp.name} BOSS`;

  // Campo (evita di ripetere lo stesso di fila)
  const pitchPool = prevPitch ? PITCH_ORDER.filter((id) => id !== prevPitch) : PITCH_ORDER;
  const pitch = rng.pick(pitchPool);

  // Regola speciale
  const rule: SurvivalRuleId = round === 1
    ? 'normal'
    : isBoss
      ? rng.pick(['fire', 'super2x', 'turbo'])
      : rng.pick(ROUND_RULES);
  const rDef = SURVIVAL_RULES[rule];

  // Meteo/orario
  let weather: Weather = rDef.weather ?? 'sereno';
  let night = rDef.night ?? (pitch === 'tetto');
  if (!rDef.weather && round >= 3 && rng.chance(0.28)) {
    weather = rng.pick(['pioggia', 'nebbia']);
  }
  if (rDef.night === undefined && pitch !== 'tetto' && round >= 2 && rng.chance(0.25)) {
    night = true;
  }

  // Difficoltà CPU che scala gradualmente
  let difficulty: Difficulty = baseDiff;
  if (round >= 6 && baseDiff === 'facile') difficulty = 'normale';
  if (round >= 9 && baseDiff === 'normale') difficulty = 'difficile';
  if (isBoss && difficulty === 'facile') difficulty = 'normale';

  return {
    oppId: baseOpp.id,
    opp,
    pitch,
    weather,
    night,
    rule,
    difficulty,
    durationSec: rDef.durationSec ?? 90,
    isBoss,
  };
}

export function newSurvival(teamId: string, difficulty: Difficulty, seed = Date.now()): SurvivalState {
  const team = cloneTeam(teamById(teamId));
  return {
    active: true,
    seed,
    round: 1,
    difficulty,
    team,
    perks: [],
    stolen: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    coinsEarned: 0,
    next: generateRound(1, difficulty, seed, team.id),
  };
}

export function survivalLaunch(s: SurvivalState, fixKits: (h: TeamDef, a: TeamDef) => TeamDef): MatchLaunch {
  const n = s.next;
  const rDef = SURVIVAL_RULES[n.rule];
  const mods: MatchMods = { ...rDef.mods };
  let superStart = 0;

  for (const pk of s.perks) {
    if (pk === 'superStart') superStart = Math.min(1, superStart + 0.6);
    if (pk === 'turboStart') mods.startTurbo = (mods.startTurbo ?? 0) + 8;
    if (pk === 'wallStart') mods.startWall = (mods.startWall ?? 0) + 10;
    if (pk === 'stamina') mods.staminaMult = 0;
  }

  return {
    mode: 'sopravvivenza',
    modeData: { round: s.round },
    superStart,
    hudGoal: `ROUND ${s.round}${n.isBoss ? ' BOSS' : ''} · ${rDef.name}`,
    config: {
      home: cloneTeam(s.team),
      away: fixKits(s.team, cloneTeam(n.opp)),
      pitch: PITCHES[n.pitch],
      difficulty: n.difficulty,
      durationSec: n.durationSec,
      powerUps: true,
      goldenGoal: true,
      humanTeam: 0,
      weather: n.weather,
      night: n.night,
      mods,
    },
  };
}

function buildDraft(s: SurvivalState): SurvivalDraftOption[] {
  const rng = new Rng(s.seed + s.round * 4099);
  const oppPlayers = s.next.opp.players;
  // Scegliamo 2 giocatori avversari con ruoli diversi (almeno uno offensivo/centrocampo e uno difensivo/portiere)
  const idxPoolA = [4, 2, 3];
  const idxPoolB = [1, 0, 3];
  const idxA = rng.pick(idxPoolA);
  let idxB = rng.pick(idxPoolB);
  if (idxB === idxA) idxB = (idxA + 1) % 5;

  const steals: SurvivalDraftOption[] = [idxA, idxB].map((roleIdx) => ({
    kind: 'steal',
    player: clonePlayer(oppPlayers[roleIdx]),
    roleIdx,
    fromTeam: s.next.opp.name,
  }));

  // Bonus squadra: evitiamo di proporre due volte i perk non cumulabili (stamina) se già posseduti
  const availPerks = PERK_ORDER.filter((id) => {
    if (id === 'stamina' && s.perks.includes('stamina')) return false;
    if (id === 'superStart' && s.perks.filter((x) => x === 'superStart').length >= 1) return false;
    return true;
  });
  const fallback: SurvivalPerkId[] = ['speed', 'shot', 'pass', 'tackle'];
  const perkId = rng.pick(availPerks.length ? availPerks : fallback);

  return [...steals, { kind: 'perk', perkId }];
}

export interface SurvivalMatchReport {
  won: boolean;
  coins: number;
  packs: number;
  isBoss: boolean;
  roundCleared: number;
}

export function applySurvivalMatch(s: SurvivalState, out: MatchOutcome, record?: SurvivalRecord): SurvivalMatchReport {
  const [a, b] = out.result.score;
  const won = out.result.penalties ? out.result.penalties[0] > out.result.penalties[1] : a > b;
  s.goalsFor += a;
  s.goalsAgainst += b;

  if (won) {
    const isBoss = s.next.isBoss;
    const coins = (20 + s.round * 8) * (isBoss ? 2 : 1);
    const packs = s.round % 3 === 0 || isBoss ? 1 : 0;
    s.coinsEarned += coins;
    s.pendingDraft = buildDraft(s);
    return { won: true, coins, packs, isBoss, roundCleared: s.round };
  }

  // Sconfitta: fine della scalata
  const cleared = s.round - 1;
  const prevBest = record?.bestRound ?? 0;
  const newRecord = cleared > prevBest;
  const bonusCoins = cleared * 10;
  s.coinsEarned += bonusCoins;
  s.active = false;
  s.pendingDraft = undefined;
  s.lastSummary = {
    roundReached: s.round,
    wins: cleared,
    score: [a, b],
    coins: s.coinsEarned,
    packs: Math.floor(cleared / 3),
    newRecord,
    teamName: s.team.name,
    stolen: s.stolen,
  };
  return { won: false, coins: bonusCoins, packs: 0, isBoss: s.next.isBoss, roundCleared: cleared };
}

export function pickDraftOption(s: SurvivalState, idx: number): boolean {
  const opt = s.pendingDraft?.[idx];
  if (!opt || !s.active) return false;
  if (opt.kind === 'steal') {
    const nextP = clonePlayer(opt.player);
    // Il giocatore rubato riceve anche i bonus statistici già raccolti in questa run
    for (const pk of s.perks) applyStatPerkToPlayer(nextP, pk);
    s.team.players[opt.roleIdx] = nextP;
    s.stolen++;
  } else {
    s.perks.push(opt.perkId);
    for (const p of s.team.players) applyStatPerkToPlayer(p, opt.perkId);
  }
  s.pendingDraft = undefined;
  s.round++;
  s.next = generateRound(s.round, s.difficulty, s.seed, s.team.id, s.next.pitch);
  return true;
}

/** Differenza sintetica tra giocatore candidato e titolare attuale (per mostrare badge nella UI). */
export function statDiffs(candidate: PlayerDef, current: PlayerDef): { label: string; delta: number }[] {
  const keys: [keyof PlayerStats, string][] = [
    ['speed', 'VEL'],
    ['shot', 'TIR'],
    ['pass', 'PAS'],
    ['tackle', 'CON'],
    ['keeping', 'PAR'],
  ];
  return keys
    .map(([k, label]) => ({ label, delta: Math.round((candidate.stats[k] - current.stats[k]) * 100) }))
    .filter((x) => Math.abs(x.delta) >= 2)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
}
