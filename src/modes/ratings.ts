import type { MatchResult, Role, TeamDef } from '../sim/types';
import type { MatchTally, PlayerTally } from './tally';

/** Pagella di fine partita: un voto da 4 a 10 per ogni giocatore, come sul giornale. */

export interface Rating {
  team: 0 | 1;
  idx: number;
  name: string;
  role: Role;
  vote: number;
  /** Cosa ha fatto (es. "2 gol, 1 assist"). */
  note: string;
}

const EMPTY: PlayerTally = { goals: 0, assists: 0, shots: 0, passes: 0, tackles: 0, saves: 0, tricks: 0, fouls: 0, reds: 0 };

export function voteFor(role: Role, s: PlayerTally, scored: number, conceded: number): number {
  let v = 6;
  v += s.goals * 1 + s.assists * 0.6 + s.shots * 0.1 + Math.min(12, s.passes) * 0.04;
  v += s.tackles * 0.25 + s.saves * 0.4 + s.tricks * 0.2;
  v -= s.fouls * 0.25 + s.reds * 1;
  // risultato: conta di più per portiere e difensori
  const back = role === 'GK' ? 0.45 : role === 'DEF' ? 0.3 : 0.12;
  v -= conceded * back;
  if (conceded === 0 && (role === 'GK' || role === 'DEF')) v += 0.5;
  v += scored > conceded ? 0.3 : scored < conceded ? -0.3 : 0;
  return Math.max(4, Math.min(10, Math.round(v * 2) / 2));
}

function note(s: PlayerTally): string {
  const parts: string[] = [];
  if (s.goals) parts.push(`${s.goals} gol`);
  if (s.assists) parts.push(`${s.assists} assist`);
  if (s.saves) parts.push(`${s.saves} parat${s.saves > 1 ? 'e' : 'a'}`);
  if (s.tricks) parts.push(`${s.tricks} giocat${s.tricks > 1 ? 'e' : 'a'}`);
  if (s.tackles && parts.length < 2) parts.push(`${s.tackles} contrast${s.tackles > 1 ? 'i' : 'o'}`);
  if (s.reds) parts.push('espulso');
  return parts.slice(0, 2).join(', ');
}

export function teamRatings(team: TeamDef, side: 0 | 1, tally: MatchTally, result: MatchResult): Rating[] {
  const scored = result.score[side];
  const conceded = result.score[side === 0 ? 1 : 0];
  return team.players.map((pd, i) => {
    const s = tally.players[side][i] ?? EMPTY;
    return { team: side, idx: i, name: pd.name, role: pd.role, vote: voteFor(pd.role, s, scored, conceded), note: note(s) };
  });
}

/** Il migliore in campo tra le due squadre (a parità, chi ha vinto). */
export function bestOnPitch(home: Rating[], away: Rating[], result: MatchResult): Rating {
  const winner = result.score[0] >= result.score[1] ? 0 : 1;
  return [...home, ...away].reduce((b, r) => (r.vote > b.vote || (r.vote === b.vote && r.team === winner && b.team !== winner) ? r : b));
}
