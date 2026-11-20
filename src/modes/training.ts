import type { Role, TeamDef } from '../sim/types';
import type { GoalPoint } from './penalties';
import { goalDist } from './penalties';
import { addXp, type LevelUp, type ProgressSave } from './progress';

/**
 * Allenamento: tre esercizi davanti alla porta. Il punteggio fa crescere i giocatori
 * del ruolo allenato (le prime sessioni di ogni giorno).
 */

export type DrillId = 'bersagli' | 'punizioni' | 'portiere' | 'volo';

export interface DrillDef {
  id: DrillId;
  name: string;
  desc: string;
  /** Tiri per sessione. */
  shots: number;
  /** Ruoli che crescono. */
  roles: Role[];
  /** Esperienza per punto. */
  xpPer: number;
}

export const DRILLS: DrillDef[] = [
  { id: 'bersagli', name: 'TIRO AL BERSAGLIO', desc: 'Colpisci i bersagli nella porta', shots: 10, roles: ['FWD', 'MID'], xpPer: 2 },
  { id: 'punizioni', name: 'PUNIZIONI', desc: 'Scavalca la barriera, usa l\'effetto', shots: 6, roles: ['FWD', 'MID', 'DEF'], xpPer: 3 },
  { id: 'portiere', name: 'RIFLESSI DEL PORTIERE', desc: 'Tuffati e para i tiri', shots: 10, roles: ['GK'], xpPer: 4 },
  { id: 'volo', name: 'TIRO AL VOLO', desc: 'Colpisci il cross al volo o in rovesciata', shots: 8, roles: ['FWD', 'MID'], xpPer: 3 },
];

/** Sessioni al giorno che danno esperienza (le altre servono per il record). */
export const TRAIN_SESSIONS = 3;

export interface TrainingSave {
  best: Partial<Record<DrillId, number>>;
  day: string;
  sessions: number;
}

export interface Target extends GoalPoint {
  r: number;
}

/** Punti di un tiro sui bersagli: centro 5, bersaglio 3, porta 1. */
export function targetPoints(ball: GoalPoint, targets: Target[]): number {
  let best = 0;
  for (const t of targets) {
    const d = goalDist(ball, t);
    if (d <= t.r * 0.4) best = Math.max(best, 5);
    else if (d <= t.r) best = Math.max(best, 3);
  }
  if (best) return best;
  return Math.abs(ball.u) < 0.95 && ball.v < 0.94 ? 1 : 0;
}

/** Bersagli del tiro n: si rimpiccioliscono andando avanti. */
export function targetsFor(n: number, rnd: () => number): Target[] {
  const r = Math.max(0.16, 0.3 - n * 0.015);
  const count = n < 4 ? 2 : 1;
  const out: Target[] = [];
  for (let i = 0; i < count; i++) {
    const side = i === 0 ? -1 : 1;
    const u = count === 1 ? (rnd() * 2 - 1) * 0.72 : side * (0.25 + rnd() * 0.5);
    out.push({ u, v: 0.12 + r * 0.6 + rnd() * (0.72 - r * 1.2), r });
  }
  return out;
}

/** Punti del tiro al volo in base all'anticipo/ritardo rispetto al punto ideale (-1..1). */
export function volleyPoints(offset: number, onGoal: boolean): { pts: number; kind: 'rovesciata' | 'volo' | 'tardi' | 'fuori' } {
  if (!onGoal) return { pts: 0, kind: 'fuori' };
  const d = Math.abs(offset);
  if (d <= 0.14) return { pts: 5, kind: 'rovesciata' };
  if (d <= 0.34) return { pts: 3, kind: 'volo' };
  if (d <= 0.6) return { pts: 1, kind: 'volo' };
  return { pts: 0, kind: 'tardi' };
}

export function trainingState(s: TrainingSave | undefined, day: string): TrainingSave {
  if (!s) return { best: {}, day, sessions: 0 };
  if (s.day !== day) return { ...s, day, sessions: 0 };
  return s;
}

export interface TrainingReward {
  xp: number;
  record: boolean;
  ups: LevelUp[];
  /** Sessione oltre il limite del giorno: niente esperienza. */
  tired: boolean;
}

/** Chiude una sessione: record ed esperienza ai giocatori del ruolo allenato. */
export function finishTraining(p: ProgressSave, t: TrainingSave, team: TeamDef, drill: DrillDef, score: number): TrainingReward {
  const record = score > (t.best[drill.id] ?? 0);
  if (record) t.best[drill.id] = score;
  const tired = t.sessions >= TRAIN_SESSIONS;
  t.sessions++;
  const xp = tired ? 0 : score * drill.xpPer;
  const ups = xp > 0 ? addXp(p, team, (pd) => (drill.roles.includes(pd.role) ? xp : 0)) : [];
  return { xp, record, ups, tired };
}
