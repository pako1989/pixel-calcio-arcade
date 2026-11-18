import { TEAMS, teamById } from '../data/teams';
import { PITCH_ORDER } from '../data/pitches';
import { Rng } from '../sim/math';
import type { Difficulty, PitchId } from '../sim/types';

/** Coppa a eliminazione diretta a 8 squadre: quarti, semifinali, finale. */

export const ROUND_NAMES = ['QUARTI DI FINALE', 'SEMIFINALE', 'FINALE'];

export interface TMatch {
  a: string;
  b: string;
  ga: number;
  gb: number;
  winner: string;
  /** Deciso al golden gol. */
  golden?: boolean;
}

export interface TournamentState {
  teamId: string;
  difficulty: Difficulty;
  seed: number;
  /** Le 8 squadre in ordine di tabellone: (0,1) (2,3) (4,5) (6,7). */
  bracket: string[];
  /** Turno attuale: 0 quarti, 1 semifinali, 2 finale, 3 coppa finita. */
  round: number;
  results: TMatch[][];
  pitches: PitchId[];
  eliminated: boolean;
  champion?: string;
}

export function newTournament(teamId: string, difficulty: Difficulty, seed = Date.now()): TournamentState {
  const rng = new Rng(seed);
  const others = TEAMS.map((t) => t.id).filter((id) => id !== teamId);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const bracket = [teamId, ...others].slice(0, 8);
  // campi diversi a ogni turno, la finale sempre allo stadio
  const pool = PITCH_ORDER.filter((p) => p !== 'stadio');
  const p1 = rng.pick(pool);
  const p2 = rng.pick(pool.filter((p) => p !== p1));
  return { teamId, difficulty, seed, bracket, round: 0, results: [], pitches: [p1, p2, 'stadio'], eliminated: false };
}

/** Squadre ancora in gara all'inizio del turno r, in ordine di tabellone. */
export function roundTeams(st: TournamentState, r: number): string[] {
  if (r === 0) return st.bracket;
  return (st.results[r - 1] ?? []).map((m) => m.winner);
}

/** Avversario della squadra del giocatore nel turno attuale (null se fuori o finita). */
export function userOpponent(st: TournamentState): string | null {
  if (st.eliminated || st.round > 2) return null;
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
  const aWins = rng.chance(0.5 + (sa - sb) * 0.08);
  return { a, b, ga: ga + (aWins ? 1 : 0), gb: gb + (aWins ? 0 : 1), winner: aWins ? a : b, golden: true };
}

function playRound(st: TournamentState, rng: Rng, user?: { ga: number; gb: number; golden: boolean }) {
  const teams = roundTeams(st, st.round);
  const res: TMatch[] = [];
  for (let i = 0; i < teams.length; i += 2) {
    const a = teams[i];
    const b = teams[i + 1];
    if (user && (a === st.teamId || b === st.teamId)) {
      const mineA = a === st.teamId;
      const ga = mineA ? user.ga : user.gb;
      const gb = mineA ? user.gb : user.ga;
      res.push({ a, b, ga, gb, winner: ga > gb ? a : b, golden: user.golden });
    } else {
      res.push(quickMatch(a, b, rng));
    }
  }
  st.results[st.round] = res;
  st.round++;
  if (st.round > 2) st.champion = res[0].winner;
}

/**
 * Registra la partita del giocatore (gol fatti e subiti dal suo punto di vista),
 * simula le altre del turno e passa al turno successivo.
 * Se il giocatore è eliminato, la coppa viene completata in automatico.
 */
export function applyUserResult(st: TournamentState, myGoals: number, oppGoals: number, golden: boolean): 'avanti' | 'eliminato' | 'campione' {
  const rng = new Rng(st.seed + st.round * 101 + myGoals * 7 + oppGoals * 13);
  if (myGoals === oppGoals) myGoals++; // non dovrebbe succedere: c'è il golden gol
  playRound(st, rng, { ga: myGoals, gb: oppGoals, golden });
  if (myGoals < oppGoals) {
    st.eliminated = true;
    while (st.round <= 2) playRound(st, rng);
    return 'eliminato';
  }
  return st.champion === st.teamId ? 'campione' : 'avanti';
}
