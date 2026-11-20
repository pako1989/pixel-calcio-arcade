import type { Difficulty, PlayerDef, TeamDef } from '../sim/types';
import type { Rng } from '../sim/math';

/**
 * Calci di rigore: regole della serie e risoluzione dei tiri, senza grafica.
 * Coordinate della porta: u da -1 (palo sinistro) a 1 (palo destro), v da 0 (terra) a 1 (traversa).
 */

export type PenOutcome = 'gol' | 'parato' | 'fuori' | 'palo';

export interface PenKick {
  team: 0 | 1;
  taker: string;
  result: PenOutcome;
}

export interface Shootout {
  first: 0 | 1;
  kicks: PenKick[];
}

export interface GoalPoint {
  u: number;
  v: number;
}

export function newShootout(first: 0 | 1): Shootout {
  return { first, kicks: [] };
}

/** Squadra che tira adesso. */
export function nextTeam(s: Shootout): 0 | 1 {
  return (s.kicks.length % 2 === 0 ? s.first : 1 - s.first) as 0 | 1;
}

export function goals(s: Shootout): [number, number] {
  const g: [number, number] = [0, 0];
  for (const k of s.kicks) if (k.result === 'gol') g[k.team]++;
  return g;
}

export function taken(s: Shootout): [number, number] {
  const t: [number, number] = [0, 0];
  for (const k of s.kicks) t[k.team]++;
  return t;
}

/** La serie è decisa? Prima i cinque tiri a testa (con chiusura anticipata), poi a oltranza. */
export function isOver(s: Shootout): boolean {
  const [ga, gb] = goals(s);
  const [ta, tb] = taken(s);
  if (ta < 5 || tb < 5) {
    if (ga + (5 - ta) < gb) return true;
    if (gb + (5 - tb) < ga) return true;
    return false;
  }
  return ta === tb && ga !== gb;
}

export function winner(s: Shootout): 0 | 1 | null {
  if (!isOver(s)) return null;
  const [ga, gb] = goals(s);
  return ga > gb ? 0 : 1;
}

/** Rigoristi in ordine: i migliori tiratori prima, il portiere per ultimo. */
export function takers(team: TeamDef): PlayerDef[] {
  const out = team.players.filter((p) => p.role !== 'GK').sort((a, b) => b.stats.shot - a.stats.shot);
  const gk = team.players.find((p) => p.role === 'GK');
  if (gk) out.push(gk);
  return out;
}

export function keeperOf(team: TeamDef): PlayerDef {
  return team.players.find((p) => p.role === 'GK') ?? team.players[0];
}

/** Distanza "in metri di porta": la porta è larga 3 volte la sua altezza. */
export function goalDist(a: GoalPoint, b: GoalPoint): number {
  return Math.hypot((a.u - b.u) * 1.5, a.v - b.v);
}

/** Dove finisce davvero il pallone (palo, fuori, parata o gol). */
export function resolveShot(ball: GoalPoint, dive: GoalPoint | null, reach: number): PenOutcome {
  const au = Math.abs(ball.u);
  if (au > 1.05 || ball.v > 1.07) return 'fuori';
  if (au >= 0.95 || ball.v >= 0.94) return 'palo';
  const k = dive ?? { u: 0, v: 0.35 };
  const r = dive ? reach : reach * 0.75;
  if (goalDist(ball, k) <= r) return 'parato';
  return 'gol';
}

const DIFF_CPU = {
  facile: { guess: 0.16, reach: 0.25, aim: 0.2 },
  normale: { guess: 0.24, reach: 0.29, aim: 0.13 },
  difficile: { guess: 0.34, reach: 0.33, aim: 0.08 },
} satisfies Record<Difficulty, { guess: number; reach: number; aim: number }>;

/** Portata del portiere: più ampia con un buon portiere. */
export function keeperReach(gk: PlayerDef, base = 0.46): number {
  return base * (0.75 + gk.stats.keeping * 0.3);
}

/** Tiro dell'utente: punto mirato + forza (0..1 dalla barra). */
export function userShot(aim: GoalPoint, power: number, taker: PlayerDef, rng: Rng): GoalPoint {
  // zona ideale della barra: 0.55..0.82
  const miss = power < 0.55 ? 0.55 - power : power > 0.82 ? power - 0.82 : 0;
  const spread = 0.03 + (1.2 - taker.stats.shot) * 0.12 + miss * 0.6;
  const a = rng.next() * Math.PI * 2;
  const r = spread * Math.sqrt(rng.next());
  let v = aim.v + Math.sin(a) * r;
  // troppa forza: il pallone si alza
  if (power > 0.9) v += (power - 0.9) * 6;
  return { u: aim.u + (Math.cos(a) * r) / 1.5, v: Math.max(0.02, v) };
}

/** Tuffo del portiere CPU: a volte indovina l'angolo, altrimenti sceglie a caso. */
export function cpuDive(ball: GoalPoint, diff: Difficulty, power: number, rng: Rng): GoalPoint | null {
  const d = DIFF_CPU[diff];
  // tiro debole: più tempo per arrivarci
  const guess = d.guess + (power < 0.45 ? 0.25 : 0);
  if (rng.chance(0.12)) return null; // resta fermo al centro
  if (rng.chance(guess)) return { u: ball.u + rng.range(-0.15, 0.15), v: ball.v + rng.range(-0.15, 0.15) };
  return { u: rng.pick([-0.85, -0.6, -0.35, 0.35, 0.6, 0.85]), v: rng.range(0.1, 0.85) };
}

export function cpuReach(gk: PlayerDef, diff: Difficulty, power: number): number {
  return keeperReach(gk, DIFF_CPU[diff].reach) + (power < 0.45 ? 0.12 : 0);
}

/** Tiro della CPU: angolo scelto più un errore che dipende dal tiratore e dalla pressione. */
export function cpuShot(taker: PlayerDef, diff: Difficulty, rng: Rng, pressure = 0): GoalPoint {
  const d = DIFF_CPU[diff];
  const center = rng.chance(0.12);
  const aim: GoalPoint = center
    ? { u: rng.range(-0.15, 0.15), v: rng.range(0.3, 0.7) }
    : { u: rng.pick([-1, 1]) * rng.range(0.45, 0.85), v: rng.range(0.1, 0.8) };
  const spread = d.aim + (1.2 - taker.stats.shot) * 0.1 + pressure * 0.05;
  const a = rng.next() * Math.PI * 2;
  const r = spread * Math.sqrt(rng.next());
  return { u: aim.u + (Math.cos(a) * r) / 1.5, v: Math.max(0.03, aim.v + Math.sin(a) * r) };
}

/**
 * Parata dell'utente: il tuffo verso il punto toccato. Se il tocco arriva dopo il tiro,
 * il portiere copre meno spazio (late = 0 in tempo, 1 al limite).
 */
export function userReach(gk: PlayerDef, late: number): number {
  return keeperReach(gk, 0.33) * (1 - Math.min(1, Math.max(0, late)) * 0.4);
}

/** Serie simulata in un istante (partite della CPU nel torneo). */
export function quickShootout(a: TeamDef, b: TeamDef, rng: Rng): [number, number] {
  const s = newShootout(rng.chance(0.5) ? 0 : 1);
  const tk = [takers(a), takers(b)];
  const gk = [keeperOf(a), keeperOf(b)];
  let guard = 0;
  while (!isOver(s) && guard++ < 60) {
    const t = nextTeam(s);
    const n = taken(s)[t];
    const taker = tk[t][n % tk[t].length];
    const ball = cpuShot(taker, 'normale', rng);
    const res = resolveShot(ball, cpuDive(ball, 'normale', 0.7, rng), cpuReach(gk[1 - t], 'normale', 0.7));
    s.kicks.push({ team: t, taker: taker.name, result: res });
  }
  return goals(s);
}
