import { TEAMS, teamById } from '../data/teams';
import { PITCH_ORDER } from '../data/pitches';
import { Rng } from '../sim/math';
import type { Difficulty, FormationId, PitchId, Weather } from '../sim/types';
import { quickShootout } from './penalties';
import { randomConditions } from '../data/weather';

/** Coppa a eliminazione diretta a 4 o 8 squadre: quarti (se 8), semifinali, finale. */

export const ROUND_NAMES = ['QUARTI DI FINALE', 'SEMIFINALE', 'FINALE'];

export type TournamentSize = 4 | 8;

export interface TournamentScorer {
  name: string;
  teamId: string;
  goals: number;
}

export interface TMatch {
  a: string;
  b: string;
  ga: number;
  gb: number;
  winner: string;
  /** Deciso al golden gol. */
  golden?: boolean;
  /** Deciso ai rigori: [rigori a, rigori b]. */
  pens?: [number, number];
}

export interface TournamentState {
  teamId: string;
  difficulty: Difficulty;
  seed: number;
  /** Numero di squadre: 4 (Coppa Lampo) o 8 (Coppa Pixel). */
  size?: TournamentSize;
  /** Modulo tattico scelto per la coppa. */
  formation?: FormationId;
  /** Squadre in ordine di tabellone. */
  bracket: string[];
  /** Turno attuale: 0..totalRounds-1, oppure totalRounds a coppa finita. */
  round: number;
  results: TMatch[][];
  pitches: PitchId[];
  eliminated: boolean;
  champion?: string;
  /** Classifica marcatori del torneo indicizzata per `${teamId}:${name}`. */
  scorers?: Record<string, TournamentScorer>;
}

export function totalRounds(st: TournamentState): number {
  return (st.size ?? st.bracket.length) === 4 ? 2 : 3;
}

export function roundLabel(st: TournamentState, r = st.round): string {
  return totalRounds(st) === 2 ? ROUND_NAMES[Math.min(2, r + 1)] : ROUND_NAMES[Math.min(2, r)];
}

export function newTournament(
  teamId: string,
  difficulty: Difficulty,
  seed = Date.now(),
  size: TournamentSize = 8,
  formation: FormationId = '1-2-1',
): TournamentState {
  const rng = new Rng(seed);
  const others = TEAMS.map((t) => t.id).filter((id) => id !== teamId);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const bracket = [teamId, ...others].slice(0, size);
  // campi diversi a ogni turno, la finale sempre allo stadio
  const pool = PITCH_ORDER.filter((p) => p !== 'stadio');
  const p1 = rng.pick(pool);
  const p2 = rng.pick(pool.filter((p) => p !== p1));
  const pitches: PitchId[] = size === 4 ? [p1, 'stadio'] : [p1, p2, 'stadio'];
  return { teamId, difficulty, seed, size, formation, bracket, round: 0, results: [], pitches, eliminated: false, scorers: {} };
}

/** Squadre ancora in gara all'inizio del turno r, in ordine di tabellone. */
export function roundTeams(st: TournamentState, r: number): string[] {
  if (r === 0) return st.bracket;
  return (st.results[r - 1] ?? []).map((m) => m.winner);
}

/** Avversario della squadra del giocatore nel turno attuale (null se fuori o finita). */
export function userOpponent(st: TournamentState): string | null {
  if (st.eliminated || st.round >= totalRounds(st)) return null;
  const teams = roundTeams(st, st.round);
  const i = teams.indexOf(st.teamId);
  if (i < 0) return null;
  return teams[i ^ 1];
}

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

/** Partita simulata in un istante, in base alla forza delle squadre. */
export function quickMatch(a: string, b: string, rng: Rng): TMatch {
  const sa = teamById(a).stars;
  const sb = teamById(b).stars;
  const ga = poisson(rng, Math.max(0.6, 2.1 + (sa - sb) * 0.45));
  const gb = poisson(rng, Math.max(0.6, 2.1 + (sb - sa) * 0.45));
  if (ga !== gb) return { a, b, ga, gb, winner: ga > gb ? a : b };
  // pareggio: calci di rigore
  const pens = quickShootout(teamById(a), teamById(b), rng);
  return { a, b, ga, gb, winner: pens[0] > pens[1] ? a : b, pens };
}

function addScorerGoal(st: TournamentState, teamId: string, name: string) {
  const map = (st.scorers = st.scorers ?? {});
  const key = `${teamId}:${name}`;
  if (!map[key]) map[key] = { name, teamId, goals: 0 };
  map[key].goals++;
}

function addSimGoals(st: TournamentState, teamId: string, goals: number, rng: Rng) {
  if (goals <= 0) return;
  const pls = teamById(teamId).players.filter((p) => p.role !== 'GK');
  const weights = pls.map((p) => (p.role === 'FWD' ? 4 : p.role === 'MID' ? 3 : 1));
  const tot = weights.reduce((a, b) => a + b, 0);
  for (let g = 0; g < goals; g++) {
    let r = rng.next() * tot;
    let pick = pls[pls.length - 1];
    for (let i = 0; i < pls.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = pls[i];
        break;
      }
    }
    addScorerGoal(st, teamId, pick.name);
  }
}

function playRound(
  st: TournamentState,
  rng: Rng,
  user?: { ga: number; gb: number; golden: boolean; pens?: [number, number]; scorers?: { team: 0 | 1; name: string }[] },
) {
  const teams = roundTeams(st, st.round);
  const res: TMatch[] = [];
  for (let i = 0; i < teams.length; i += 2) {
    const a = teams[i];
    const b = teams[i + 1];
    if (user && (a === st.teamId || b === st.teamId)) {
      const mineA = a === st.teamId;
      const ga = mineA ? user.ga : user.gb;
      const gb = mineA ? user.gb : user.ga;
      const pens = user.pens && (mineA ? user.pens : ([user.pens[1], user.pens[0]] as [number, number]));
      const aWins = pens ? pens[0] > pens[1] : ga > gb;
      res.push({ a, b, ga, gb, winner: aWins ? a : b, golden: user.golden, pens });
      const mineNames = user.scorers?.filter((s) => s.team === 0).map((s) => s.name) ?? [];
      const oppNames = user.scorers?.filter((s) => s.team === 1).map((s) => s.name) ?? [];
      if (mineNames.length) mineNames.forEach((n) => addScorerGoal(st, st.teamId, n));
      else addSimGoals(st, st.teamId, user.ga, rng);
      const oppId = mineA ? b : a;
      if (oppNames.length) oppNames.forEach((n) => addScorerGoal(st, oppId, n));
      else addSimGoals(st, oppId, user.gb, rng);
    } else {
      const m = quickMatch(a, b, rng);
      res.push(m);
      addSimGoals(st, a, m.ga, rng);
      addSimGoals(st, b, m.gb, rng);
    }
  }
  st.results[st.round] = res;
  st.round++;
  if (st.round >= totalRounds(st)) st.champion = res[0].winner;
}

/**
 * Registra la partita del giocatore (gol fatti e subiti dal suo punto di vista),
 * simula le altre del turno e passa al turno successivo.
 * Se il giocatore è eliminato, la coppa viene completata in automatico.
 */
export function applyUserResult(
  st: TournamentState,
  myGoals: number,
  oppGoals: number,
  golden: boolean,
  /** Rigori segnati [miei, loro] se la partita è finita in parità. */
  pens?: [number, number],
  /** Marcatori reali della partita [team 0 = mia squadra, 1 = avversaria]. */
  matchScorers?: { team: 0 | 1; name: string }[],
): 'avanti' | 'eliminato' | 'campione' {
  const rng = new Rng(st.seed + st.round * 101 + myGoals * 7 + oppGoals * 13);
  if (myGoals === oppGoals && (!pens || pens[0] === pens[1])) pens = [1, 0];
  playRound(st, rng, { ga: myGoals, gb: oppGoals, golden, pens: myGoals === oppGoals ? pens : undefined, scorers: matchScorers });
  const lost = myGoals === oppGoals ? pens![0] < pens![1] : myGoals < oppGoals;
  const maxR = totalRounds(st);
  if (lost) {
    st.eliminated = true;
    while (st.round < maxR) playRound(st, rng);
    return 'eliminato';
  }
  return st.champion === st.teamId ? 'campione' : 'avanti';
}

/** Classifica marcatori del torneo ordinata per gol (a parità premia la tua squadra). */
export function topScorers(st: TournamentState, limit = 5): TournamentScorer[] {
  return Object.values(st.scorers ?? {})
    .sort((a, b) => b.goals - a.goals || Number(b.teamId === st.teamId) - Number(a.teamId === st.teamId) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Premio in monete a fine torneo (piazzamento + titolo Capocannoniere). */
export function tournamentPrize(st: TournamentState): { coins: number; cupCoins: number; scorerCoins: number; isTopScorer: boolean } {
  const maxR = totalRounds(st);
  const four = maxR === 2;
  let cupCoins = 15;
  if (st.champion === st.teamId) cupCoins = four ? 100 : 180;
  else {
    const finalMatch = st.results[maxR - 1]?.[0];
    if (finalMatch && (finalMatch.a === st.teamId || finalMatch.b === st.teamId)) cupCoins = four ? 40 : 75;
    else if (!four && st.results.length >= 2 && roundTeams(st, 1).includes(st.teamId)) cupCoins = 35;
  }
  const board = topScorers(st, 20);
  const bestGoals = board[0]?.goals ?? 0;
  const isTopScorer = bestGoals > 0 && board.some((s) => s.goals === bestGoals && s.teamId === st.teamId);
  const scorerCoins = isTopScorer ? 60 : 0;
  return { coins: cupCoins + scorerCoins, cupCoins, scorerCoins, isTopScorer };
}

/** Meteo e orario di una partita del torneo (sempre gli stessi per quel turno). */
export function roundConditions(st: TournamentState, round: number): { weather: Weather; night: boolean } {
  const rng = new Rng(st.seed * 7 + round * 977);
  const isFinal = round === totalRounds(st) - 1;
  // la finale si gioca sempre di sera, sotto i riflettori
  const c = randomConditions(st.pitches[round], () => rng.next());
  return isFinal ? { weather: c.weather, night: true } : c;
}
